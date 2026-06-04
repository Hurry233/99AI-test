import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FileSearchDto {
  @ApiProperty({ description: '搜索关键词' })
  @IsString()
  query: string;

  @ApiProperty({ description: '限定文件ID', required: false })
  @IsOptional()
  @IsString()
  fileId?: string;

  @ApiProperty({ description: '会话/对话组ID', required: false })
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class FileReaderDto {
  @ApiProperty({ description: '内部文件ID' })
  @IsString()
  fileId: string;

  @ApiProperty({ description: '页码', required: false })
  @IsOptional()
  pageNumber?: number;

  @ApiProperty({ description: 'Sheet名称', required: false })
  @IsOptional()
  @IsString()
  sheetName?: string;

  @ApiProperty({ description: '段落ID', required: false })
  @IsOptional()
  @IsString()
  paragraphId?: string;
}
