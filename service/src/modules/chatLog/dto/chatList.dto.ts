import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class ChatListDto {
  @ApiProperty({ example: 1, description: '对话分组ID', required: false })
  @IsOptional()
  groupId: number;

  @ApiProperty({ example: 'full', description: 'trace返回模式：full/page/none', required: false })
  @IsOptional()
  @IsIn(['full', 'page', 'none'])
  traceMode?: 'full' | 'page' | 'none';

  @ApiProperty({ example: 1, description: 'trace分页页码', required: false })
  @IsOptional()
  tracePage?: number;

  @ApiProperty({ example: 20, description: 'trace分页条数', required: false })
  @IsOptional()
  traceSize?: number;
}
