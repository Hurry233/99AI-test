import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class RetryTraceItemDto {
  @ApiProperty({ example: 123, description: '本次运行/助手消息ID' })
  @IsNotEmpty({ message: 'runId不能为空' })
  runId: number;

  @ApiProperty({ example: 'search-123', description: '失败 trace item ID' })
  @IsNotEmpty({ message: 'failedItemId不能为空' })
  failedItemId: string;
}
