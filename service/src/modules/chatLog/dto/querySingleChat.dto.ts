import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional } from 'class-validator';

export class QuerySingleChatDto {
  @ApiProperty({ example: '123', description: '聊天记录ID' })
  @IsNotEmpty({ message: '聊天记录ID不能为空' })
  chatId: number;

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
