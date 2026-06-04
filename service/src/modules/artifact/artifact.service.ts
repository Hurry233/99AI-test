import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';
import { In, Repository } from 'typeorm';
import { ArtifactEntity } from './artifact.entity';
import { UploadService } from '../upload/upload.service';

export interface CreateImageArtifactInput {
  base64: string;
  mimeType?: string;
  prompt?: string;
  model?: string;
  sourceRunId?: string | number;
  parentArtifactId?: string;
  metadata?: Record<string, any>;
  user?: any;
  groupId?: number;
}

@Injectable()
export class ArtifactService {
  constructor(
    @InjectRepository(ArtifactEntity)
    private readonly artifactEntity: Repository<ArtifactEntity>,
    private readonly uploadService: UploadService,
  ) {}

  async createImageArtifact(input: CreateImageArtifactInput) {
    const { cleanBase64, mimeType } = this.normalizeBase64Image(input.base64, input.mimeType);
    const buffer = Buffer.from(cleanBase64, 'base64');
    const storageUrl = await this.uploadService.uploadFile(
      {
        buffer,
        mimetype: mimeType,
      },
      'artifacts/images',
      input.user || null,
    );

    const parentArtifact = input.parentArtifactId
      ? await this.artifactEntity.findOne({ where: { artifactId: input.parentArtifactId } })
      : null;

    const artifact = await this.artifactEntity.save({
      artifactId: `art_${uuidv4()}`,
      type: 'image',
      parentArtifactId: input.parentArtifactId || null,
      version: parentArtifact ? parentArtifact.version + 1 : 1,
      sourceRunId: input.sourceRunId ? String(input.sourceRunId) : null,
      prompt: input.prompt || '',
      model: input.model || '',
      storageUrl,
      metadata: JSON.stringify({ mimeType, ...(input.metadata || {}) }),
      userId: input.user?.id || null,
      groupId: input.groupId || null,
    });

    return this.toResponseItem(artifact);
  }

  async findBySourceRunIds(sourceRunIds: Array<string | number>) {
    const ids = sourceRunIds.map(String).filter(Boolean);
    if (!ids.length) return [];
    const artifacts = await this.artifactEntity.find({
      where: { sourceRunId: In(ids), type: 'image' },
      order: { id: 'ASC' },
    });
    return artifacts.map(artifact => this.toResponseItem(artifact));
  }

  async findByArtifactIds(artifactIds: string[]) {
    if (!artifactIds?.length) return [];
    return this.artifactEntity.find({ where: { artifactId: In(artifactIds), type: 'image' } });
  }

  toResponseItem(artifact: ArtifactEntity) {
    let metadata = {};
    try {
      metadata = artifact.metadata ? JSON.parse(artifact.metadata) : {};
    } catch (error) {
      Logger.debug(`解析artifact metadata失败: ${error.message}`, 'ArtifactService');
    }

    return {
      type: 'artifact',
      artifactType: artifact.type,
      artifactId: artifact.artifactId,
      parentArtifactId: artifact.parentArtifactId,
      version: artifact.version,
      sourceRunId: artifact.sourceRunId,
      storageUrl: artifact.storageUrl,
      prompt: artifact.prompt,
      model: artifact.model,
      metadata,
    };
  }

  buildImageEditInputs(artifacts: ArtifactEntity[]) {
    return artifacts.map(artifact => ({
      type: 'input_image',
      image_url: artifact.storageUrl,
      artifactId: artifact.artifactId,
      parentArtifactId: artifact.parentArtifactId,
      version: artifact.version,
    }));
  }

  private normalizeBase64Image(base64: string, fallbackMimeType = 'image/png') {
    const match = base64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (match) {
      return { mimeType: match[1], cleanBase64: match[2] };
    }
    return { mimeType: fallbackMimeType, cleanBase64: base64 };
  }
}
