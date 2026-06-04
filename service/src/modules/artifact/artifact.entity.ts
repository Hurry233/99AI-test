import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'artifact' })
export class ArtifactEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ comment: 'artifact唯一ID' })
  artifactId: string;

  @Column({ comment: 'artifact类型', default: 'image' })
  type: string;

  @Index()
  @Column({ comment: '父artifact ID', nullable: true })
  parentArtifactId: string;

  @Column({ comment: '版本号', default: 1 })
  version: number;

  @Index()
  @Column({ comment: '来源运行ID', nullable: true })
  sourceRunId: string;

  @Column({ comment: '生成/编辑提示词', type: 'text', nullable: true })
  prompt: string;

  @Column({ comment: '使用模型', nullable: true })
  model: string;

  @Column({ comment: '对象存储URL', type: 'text' })
  storageUrl: string;

  @Column({ comment: '元数据', type: 'text', nullable: true })
  metadata: string;

  @Index()
  @Column({ comment: '用户ID', nullable: true })
  userId: number;

  @Index()
  @Column({ comment: '会话分组ID', nullable: true })
  groupId: number;
}
