import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatgptModule } from './chatgpt/chatgpt.module';

@Module({
  imports: [ConfigModule.forRoot(), ChatgptModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
