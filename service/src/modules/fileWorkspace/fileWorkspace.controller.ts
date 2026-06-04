import { JwtAuthGuard } from '@/common/auth/jwtAuth.guard';
import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { FileReaderDto, FileSearchDto } from './dto/fileWorkspace.dto';
import { FileWorkspaceService } from './fileWorkspace.service';

@ApiTags('file-workspace')
@Controller('file-workspace')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FileWorkspaceController {
  constructor(private readonly fileWorkspaceService: FileWorkspaceService) {}

  @Get(':fileId')
  @ApiOperation({ summary: '获取工作区文件元信息' })
  async getFile(@Param('fileId') fileId: string) {
    return this.fileWorkspaceService.getFile(fileId);
  }

  @Post('file_search')
  @ApiOperation({ summary: '文件搜索工具，返回文件名、页码、sheet、行列、段落ID等引用位置' })
  async fileSearch(@Body() dto: FileSearchDto, @Req() req: Request) {
    return this.fileWorkspaceService.fileSearch(dto, (req.user as any)?.id);
  }

  @Post('file_reader')
  @ApiOperation({ summary: '文件阅读工具，按页码、sheet、段落ID读取解析内容' })
  async fileReader(@Body() dto: FileReaderDto, @Req() req: Request) {
    return this.fileWorkspaceService.fileReader(dto, (req.user as any)?.id);
  }
}
