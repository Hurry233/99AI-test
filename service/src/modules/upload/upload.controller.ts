import { JwtAuthGuard } from '@/common/auth/jwtAuth.guard';
import {
  Controller,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { FileWorkspaceService } from '../fileWorkspace/fileWorkspace.service';
import { UploadService } from './upload.service';

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly fileWorkspaceService: FileWorkspaceService,
  ) {}

  @Post('file')
  @ApiOperation({ summary: '上传文件' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB大小限制
      },
    }),
  )
  async uploadFile(@UploadedFile() file, @Req() req: Request, @Query('dir') dir?: string) {
    return this.uploadService.uploadFile(file, dir, req.user);
  }

  @Post('workspace-file')
  @ApiOperation({ summary: '上传文件并创建工作区解析任务' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  async uploadWorkspaceFile(
    @UploadedFile() file,
    @Req() req: Request,
    @Query('dir') dir?: string,
    @Query('sessionId') sessionId?: string,
    @Query('permission') permission?: string,
  ) {
    const url = await this.uploadService.uploadFile(file, dir, req.user);
    const workspaceFile = await this.fileWorkspaceService.createFromUpload({
      originalUrl: url,
      fileName: file.originalname,
      mime: file.mimetype,
      size: file.size,
      userId: (req.user as any)?.id,
      sessionId,
      permission,
      buffer: file.buffer,
    });

    return {
      url,
      fileId: workspaceFile.fileId,
      name: workspaceFile.fileName,
      mime: workspaceFile.mime,
      size: workspaceFile.size,
      status: workspaceFile.status,
      permission: workspaceFile.permission,
    };
  }

  // @Post('fileFromUrl')
  // @ApiOperation({ summary: '从URL上传文件' })
  // async uploadFileFromUrl(@Body() { url, dir = 'ai' }): Promise<any> {
  //   return this.uploadService.uploadFileFromUrl({ url, dir });
  // }
}
