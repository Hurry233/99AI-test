import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentChunkEntity } from './documentChunk.entity';
import { FileWorkspaceController } from './fileWorkspace.controller';
import { FileWorkspaceEntity } from './fileWorkspace.entity';
import { FileWorkspaceService } from './fileWorkspace.service';
import { PagePreviewEntity } from './pagePreview.entity';
import { SheetCellEntity } from './sheetCell.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      FileWorkspaceEntity,
      DocumentChunkEntity,
      SheetCellEntity,
      PagePreviewEntity,
    ]),
  ],
  controllers: [FileWorkspaceController],
  providers: [FileWorkspaceService],
  exports: [FileWorkspaceService],
})
export class FileWorkspaceModule {}
