import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ChatgptController } from './chatgpt.controller';
import { ChatgptService } from './chatgpt.service';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [ChatgptController],
  providers: [ChatgptService],
  exports: [ChatgptService],
})
export class ChatgptModule {}
