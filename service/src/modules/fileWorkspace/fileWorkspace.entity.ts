import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity, Index } from 'typeorm';

export type FileWorkspaceStatus = 'uploaded' | 'parsing' | 'parsed' | 'failed';

@Entity({ name: 'file_workspace' })
export class FileWorkspaceEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 64, comment: '内部文件ID' })
  fileId: string;

  @Column({ length: 255, comment: '原始文件名' })
  fileName: string;

  @Column({ comment: '原始URL', type: 'text' })
  originalUrl: string;

  @Column({ length: 128, nullable: true, comment: 'MIME类型' })
  mime: string;

  @Column({ comment: '文件大小', default: 0 })
  size: number;

  @Column({ comment: '用户ID', nullable: true })
  userId: number;

  @Column({ length: 64, nullable: true, comment: '会话/对话组ID' })
  sessionId: string;

  @Column({ length: 32, default: 'private', comment: '访问权限' })
  permission: string;

  @Column({ length: 32, default: 'uploaded', comment: '解析状态' })
  status: FileWorkspaceStatus;

  @Column({ type: 'text', nullable: true, comment: '解析错误' })
  errorMessage: string;

  @Column({ default: 0, comment: '是否建立向量索引' })
  vectorIndexed: boolean;

  @Column({ type: 'text', nullable: true, comment: '扩展元数据' })
  metadata: string;
}
