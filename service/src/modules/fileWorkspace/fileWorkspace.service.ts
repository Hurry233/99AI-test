import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import * as mammoth from 'mammoth';
import * as path from 'path';
import * as pdfParse from 'pdf-parse';
import { In, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { DocumentChunkEntity } from './documentChunk.entity';
import { FileReaderDto, FileSearchDto } from './dto/fileWorkspace.dto';
import { FileWorkspaceEntity } from './fileWorkspace.entity';
import { PagePreviewEntity } from './pagePreview.entity';
import { SheetCellEntity } from './sheetCell.entity';

interface UploadedWorkspaceFile {
  originalUrl: string;
  fileName: string;
  mime: string;
  size: number;
  userId?: number;
  sessionId?: string;
  permission?: string;
  buffer?: Buffer;
}

@Injectable()
export class FileWorkspaceService {
  private readonly logger = new Logger(FileWorkspaceService.name);

  constructor(
    @InjectRepository(FileWorkspaceEntity)
    private readonly fileWorkspaceRepository: Repository<FileWorkspaceEntity>,
    @InjectRepository(DocumentChunkEntity)
    private readonly documentChunkRepository: Repository<DocumentChunkEntity>,
    @InjectRepository(SheetCellEntity)
    private readonly sheetCellRepository: Repository<SheetCellEntity>,
    @InjectRepository(PagePreviewEntity)
    private readonly pagePreviewRepository: Repository<PagePreviewEntity>,
  ) {}

  async createFromUpload(input: UploadedWorkspaceFile) {
    const fileId = `file_${randomUUID().replace(/-/g, '')}`;
    const workspaceFile = await this.fileWorkspaceRepository.save({
      fileId,
      fileName: input.fileName,
      originalUrl: input.originalUrl,
      mime: input.mime,
      size: input.size || 0,
      userId: input.userId || null,
      sessionId: input.sessionId || null,
      permission: input.permission || 'private',
      status: 'uploaded',
      vectorIndexed: false,
      metadata: JSON.stringify({ extension: path.extname(input.fileName || '').toLowerCase() }),
    });

    if (input.buffer) {
      setImmediate(() => {
        this.parseFile(fileId, input.buffer, input.mime, input.fileName).catch(error => {
          this.logger.error(`文件 ${fileId} 异步解析失败: ${error.message}`);
        });
      });
    }

    return workspaceFile;
  }

  async getFile(fileId: string) {
    return this.fileWorkspaceRepository.findOne({ where: { fileId } });
  }

  async parseFile(fileId: string, buffer: Buffer, mime = '', fileName = '') {
    await this.fileWorkspaceRepository.update(
      { fileId },
      { status: 'parsing', errorMessage: null },
    );
    await this.documentChunkRepository.delete({ fileId });
    await this.sheetCellRepository.delete({ fileId });
    await this.pagePreviewRepository.delete({ fileId });

    try {
      const lowerName = (fileName || '').toLowerCase();
      if (mime.includes('pdf') || lowerName.endsWith('.pdf')) {
        await this.parsePdf(fileId, buffer);
      } else if (
        mime.includes('spreadsheet') ||
        mime.includes('excel') ||
        lowerName.endsWith('.xlsx') ||
        lowerName.endsWith('.xls')
      ) {
        await this.parseWorkbook(fileId, buffer);
      } else if (mime.includes('csv') || lowerName.endsWith('.csv')) {
        await this.parseCsv(fileId, buffer);
      } else if (mime.includes('word') || lowerName.endsWith('.docx')) {
        await this.parseWord(fileId, buffer);
      } else if (
        mime.includes('presentation') ||
        lowerName.endsWith('.ppt') ||
        lowerName.endsWith('.pptx')
      ) {
        await this.parsePresentation(fileId, buffer);
      } else if (mime.includes('markdown') || lowerName.endsWith('.md')) {
        await this.parseMarkdown(fileId, buffer.toString('utf8'));
      } else if (mime.startsWith('image/')) {
        await this.parseImage(fileId, mime, fileName);
      } else {
        await this.parsePlainText(fileId, buffer.toString('utf8'));
      }
      await this.fileWorkspaceRepository.update(
        { fileId },
        { status: 'parsed', vectorIndexed: true },
      );
    } catch (error) {
      await this.fileWorkspaceRepository.update(
        { fileId },
        { status: 'failed', errorMessage: error.message || '文件解析失败' },
      );
      throw error;
    }
  }

  async fileSearch(dto: FileSearchDto, userId?: number) {
    const query = (dto.query || '').trim();
    const fileIds = await this.resolveReadableFileIds(dto, userId);
    if (!query || fileIds.length === 0) return [];

    const chunks = await this.documentChunkRepository
      .createQueryBuilder('chunk')
      .where('chunk.fileId IN (:...fileIds)', { fileIds })
      .andWhere('chunk.content LIKE :query', { query: `%${query}%` })
      .orderBy('chunk.fileId', 'ASC')
      .addOrderBy('chunk.chunkIndex', 'ASC')
      .limit(20)
      .getMany();

    const cells = await this.sheetCellRepository
      .createQueryBuilder('cell')
      .where('cell.fileId IN (:...fileIds)', { fileIds })
      .andWhere('cell.value LIKE :query', { query: `%${query}%` })
      .orderBy('cell.fileId', 'ASC')
      .addOrderBy('cell.sheetName', 'ASC')
      .addOrderBy('cell.rowIndex', 'ASC')
      .limit(20)
      .getMany();

    return this.hydrateReferences([
      ...chunks.map(chunk => ({
        type: 'chunk',
        fileId: chunk.fileId,
        content: chunk.content,
        locator: this.parseLocator(chunk.locator),
      })),
      ...cells.map(cell => ({
        type: 'cell',
        fileId: cell.fileId,
        content: cell.value,
        locator: {
          sheetName: cell.sheetName,
          rowIndex: cell.rowIndex,
          columnIndex: cell.columnIndex,
          address: cell.address,
        },
      })),
    ]);
  }

  async fileReader(dto: FileReaderDto, userId?: number) {
    const file = await this.assertReadableFile(dto.fileId, userId);
    const chunks = await this.documentChunkRepository.find({
      where: { fileId: dto.fileId },
      order: { chunkIndex: 'ASC' },
    });
    const cells = await this.sheetCellRepository.find({
      where: { fileId: dto.fileId },
      order: { sheetName: 'ASC', rowIndex: 'ASC', columnIndex: 'ASC' },
    });
    const filteredChunks = chunks.filter(chunk => {
      if (dto.pageNumber && chunk.pageNumber !== Number(dto.pageNumber)) return false;
      if (dto.paragraphId && chunk.paragraphId !== dto.paragraphId) return false;
      return true;
    });
    const filteredCells = cells.filter(cell => !dto.sheetName || cell.sheetName === dto.sheetName);

    return {
      fileId: file.fileId,
      fileName: file.fileName,
      status: file.status,
      chunks: filteredChunks.map(chunk => ({
        ...chunk,
        locator: this.parseLocator(chunk.locator),
      })),
      cells: filteredCells,
    };
  }

  async buildSearchContext(prompt: string, fileUrl?: string, userId?: number, sessionId?: string) {
    const fileIds = this.extractFileIds(fileUrl);
    if (!prompt || fileIds.length === 0) return [];
    const keywords = prompt.split(/\s+/).filter(Boolean).slice(0, 5);
    const results = [];
    for (const keyword of keywords) {
      const partial = await this.fileSearch(
        { query: keyword, sessionId, fileId: fileIds.join(',') },
        userId,
      );
      results.push(...partial.slice(0, 5));
    }
    const unique = new Map<string, any>();
    results.forEach(item =>
      unique.set(`${item.fileId}:${JSON.stringify(item.locator)}:${item.content}`, item),
    );
    return Array.from(unique.values()).slice(0, 10);
  }

  private async parsePdf(fileId: string, buffer: Buffer) {
    const data = await pdfParse(buffer);
    const pages = data.text.split(/\n\s*\n\s*\n/g).filter(Boolean);
    await this.saveTextChunks(fileId, pages.length ? pages : [data.text], 'page');
  }

  private async parseWord(fileId: string, buffer: Buffer) {
    const result = await mammoth.extractRawText({ buffer });
    await this.saveTextChunks(fileId, this.splitParagraphs(result.value), 'paragraph');
  }

  private async parsePresentation(fileId: string, buffer: Buffer) {
    await this.saveTextChunks(
      fileId,
      [
        `PPT/PPTX 文件已登记，大小 ${buffer.length} bytes。请接入 LibreOffice 或专用转换器以提取每页文本。`,
      ],
      'slide',
    );
  }

  private async parseMarkdown(fileId: string, text: string) {
    const lines = text.split(/\r?\n/);
    const headings: string[] = [];
    const chunks: Partial<DocumentChunkEntity>[] = [];
    let paragraph = '';
    let index = 0;
    const flush = () => {
      if (!paragraph.trim()) return;
      chunks.push({
        fileId,
        chunkIndex: index,
        paragraphId: `p-${index + 1}`,
        headingPath: headings.filter(Boolean).join(' > '),
        content: paragraph.trim(),
        locator: JSON.stringify({
          paragraphId: `p-${index + 1}`,
          headingPath: headings.filter(Boolean).join(' > '),
        }),
        vectorMetadata: JSON.stringify({ indexed: true }),
      });
      paragraph = '';
      index += 1;
    };

    for (const line of lines) {
      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        flush();
        headings[heading[1].length - 1] = heading[2].trim();
        headings.length = heading[1].length;
      } else {
        paragraph += `${line}\n`;
      }
    }
    flush();
    if (chunks.length) await this.documentChunkRepository.save(chunks);
    await this.pagePreviewRepository.save({
      fileId,
      title: headings[0] || 'Markdown',
      text: text.slice(0, 2000),
    });
  }

  private async parseImage(fileId: string, mime: string, fileName: string) {
    const summary = `图片 ${fileName}（${mime}）已进入视觉处理队列；OCR文本与视觉摘要可由后续视觉模型任务回填。`;
    await this.saveTextChunks(fileId, [summary], 'image');
    await this.pagePreviewRepository.save({ fileId, title: '图片OCR与视觉摘要', text: summary });
  }

  private async parsePlainText(fileId: string, text: string) {
    await this.saveTextChunks(fileId, this.splitParagraphs(text), 'paragraph');
  }

  private async parseWorkbook(fileId: string, buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    await this.saveWorkbook(fileId, workbook);
  }

  private async parseCsv(fileId: string, buffer: Buffer) {
    const workbook = XLSX.read(buffer.toString('utf8'), { type: 'string' });
    await this.saveWorkbook(fileId, workbook);
  }

  private async saveWorkbook(fileId: string, workbook: XLSX.WorkBook) {
    const cells: Partial<SheetCellEntity>[] = [];
    const previews: Partial<PagePreviewEntity>[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][];
      previews.push({
        fileId,
        sheetName,
        title: sheetName,
        text: rows
          .slice(0, 20)
          .map(row => row.join('\t'))
          .join('\n'),
      });
      for (let row = range.s.r; row <= range.e.r; row += 1) {
        for (let column = range.s.c; column <= range.e.c; column += 1) {
          const address = XLSX.utils.encode_cell({ r: row, c: column });
          const cell = sheet[address];
          if (cell?.v === undefined || cell?.v === null || cell.v === '') continue;
          cells.push({
            fileId,
            sheetName,
            rowIndex: row + 1,
            columnIndex: column + 1,
            address,
            value: String(cell.w || cell.v),
          });
        }
      }
    }
    if (cells.length) await this.sheetCellRepository.save(cells);
    if (previews.length) await this.pagePreviewRepository.save(previews);
  }

  private async saveTextChunks(
    fileId: string,
    parts: string[],
    mode: 'page' | 'paragraph' | 'slide' | 'image',
  ) {
    const chunks = parts.flatMap((part, partIndex) =>
      this.splitParagraphs(part).map((content, paragraphIndex) => {
        const chunkIndex = partIndex * 1000 + paragraphIndex;
        const pageNumber = mode === 'page' || mode === 'slide' ? partIndex + 1 : null;
        const paragraphId = `${mode}-${partIndex + 1}-${paragraphIndex + 1}`;
        return {
          fileId,
          chunkIndex,
          pageNumber,
          paragraphId,
          content,
          locator: JSON.stringify({ pageNumber, paragraphId }),
          vectorMetadata: JSON.stringify({ indexed: true }),
        };
      }),
    );
    if (chunks.length) await this.documentChunkRepository.save(chunks);
    await this.pagePreviewRepository.save(
      parts.map((text, index) => ({
        fileId,
        pageNumber: mode === 'page' || mode === 'slide' ? index + 1 : null,
        title: `${mode}-${index + 1}`,
        text: text.slice(0, 2000),
      })),
    );
  }

  private splitParagraphs(text: string) {
    return (text || '')
      .split(/\n{2,}/)
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 500);
  }

  private extractFileIds(fileUrl?: string) {
    if (!fileUrl) return [];
    try {
      const files = JSON.parse(fileUrl);
      if (Array.isArray(files)) return files.map(file => file.fileId).filter(Boolean);
    } catch (error) {
      return [];
    }
    return [];
  }

  private async resolveReadableFileIds(dto: FileSearchDto, userId?: number) {
    if (dto.fileId) {
      const requestedFileIds = dto.fileId
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      if (!requestedFileIds.length) return [];
      const files = await this.fileWorkspaceRepository.find({
        where: { fileId: In(requestedFileIds) },
      });
      return files
        .filter(file => file.permission !== 'private' || !userId || file.userId === userId)
        .map(file => file.fileId);
    }
    const where: any = {};
    if (dto.sessionId) where.sessionId = dto.sessionId;
    if (userId) where.userId = userId;
    const files = await this.fileWorkspaceRepository.find({ where, select: ['fileId'] });
    return files.map(file => file.fileId);
  }

  private async assertReadableFile(fileId: string, userId?: number) {
    const file = await this.fileWorkspaceRepository.findOne({ where: { fileId } });
    if (!file) throw new Error('文件不存在');
    if (file.permission === 'private' && userId && file.userId !== userId)
      throw new Error('无权访问文件');
    return file;
  }

  private parseLocator(locator?: string) {
    if (!locator) return {};
    try {
      return JSON.parse(locator);
    } catch (error) {
      return {};
    }
  }

  private async hydrateReferences(items: any[]) {
    const fileIds = Array.from(new Set(items.map(item => item.fileId)));
    const files = fileIds.length
      ? await this.fileWorkspaceRepository.find({ where: { fileId: In(fileIds) } })
      : [];
    const fileMap = new Map(files.map(file => [file.fileId, file]));
    return items.map(item => ({
      ...item,
      fileName: fileMap.get(item.fileId)?.fileName || item.fileId,
      originalUrl: fileMap.get(item.fileId)?.originalUrl || '',
    }));
  }
}
