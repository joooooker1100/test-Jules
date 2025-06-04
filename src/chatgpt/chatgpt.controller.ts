import { Controller, Post, Body, UsePipes, ValidationPipe, Get, Render, Logger } from '@nestjs/common';
import { ChatgptService } from './chatgpt.service';
import { lastValueFrom, Observable } from 'rxjs';
import { AxiosResponse } from 'axios';
import { CreateChatCompletionRequestDto } from './dto/create-chat-completion-request.dto';

@Controller('chatgpt')
export class ChatgptController {
  private readonly logger = new Logger(ChatgptController.name);

  constructor(private readonly chatgptService: ChatgptService) {}

  @Get()
  @Render('chatgpt') // Assumes chatgpt.hbs in views directory
  async showChatInterface() {
    // Optionally return initial data for the template
    return { prompt: null, response: null, error: null };
  }

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  @Render('chatgpt') // Assumes chatgpt.hbs in views directory
  async getChatGptResponse(@Body() createChatCompletionDto: CreateChatCompletionRequestDto) {
    const { prompt } = createChatCompletionDto;
    try {
      // ChatgptService.fetchChatGptResponse now directly returns Promise<string>
      const chatResponseText = await this.chatgptService.fetchChatGptResponse(prompt);
      return { prompt, response: chatResponseText, error: null };
    } catch (error) {
      this.logger.error(`Error processing chat request: ${error.message}`, error.stack);
      // Error should ideally be an HttpException from the service.
      // If it has a getResponse() method, use that, otherwise default to message.
      const errorMessage = (typeof error.getResponse === 'function')
                            ? error.getResponse()
                            : (error.message || 'An unexpected error occurred.');

      // If getResponse() returns an object { message: '...', statusCode: ...}, extract message
      const finalErrorMessage = (typeof errorMessage === 'object' && errorMessage.message)
                                 ? errorMessage.message
                                 : errorMessage;

      return { prompt, response: null, error: finalErrorMessage };
    }
  }
}
