import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { ChatgptService } from './chatgpt.service';
import { Observable } from 'rxjs';
import { AxiosResponse } from 'axios';
import { CreateChatCompletionRequestDto } from './dto/create-chat-completion-request.dto';

@Controller('chatgpt')
export class ChatgptController {
  constructor(private readonly chatgptService: ChatgptService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async getChatGptResponse(@Body() createChatCompletionDto: CreateChatCompletionRequestDto): Promise<Observable<AxiosResponse<any>>> {
    return this.chatgptService.fetchChatGptResponse(createChatCompletionDto.prompt);
  }
}
