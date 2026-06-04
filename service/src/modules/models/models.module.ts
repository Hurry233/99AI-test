import { Global, Module } from '@nestjs/common';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';
import { ModelGatewayService } from './model-gateway.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelsEntity } from './models.entity';
// import { ModelsTypeEntity } from './modelType.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ModelsEntity])],
  controllers: [ModelsController],
  providers: [ModelsService, ModelGatewayService],
  exports: [ModelsService, ModelGatewayService],
})
export class ModelsModule {}
