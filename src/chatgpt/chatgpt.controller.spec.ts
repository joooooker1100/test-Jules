import { Test, TestingModule } from '@nestjs/testing';
import { ChatgptController } from './chatgpt.controller';
import { ChatgptService } from './chatgpt.service';
import { ConfigService } from '@nestjs/config';
import { CreateChatCompletionRequestDto } from './dto/create-chat-completion-request.dto';
import { HttpException } from '@nestjs/common';
// Removed 'of' and 'throwError' from rxjs as service now returns Promise

// Mock ChatgptService
const mockChatgptService = {
  fetchChatGptResponse: jest.fn(), // This will be a jest.Mock returning a Promise<string>
};

// Mock ConfigService (if controller were to use it directly)
const mockConfigService = {
  get: jest.fn(),
};

describe('ChatgptController', () => {
  let controller: ChatgptController;
  let service: ChatgptService;
  let configService: ConfigService; // Add this

  beforeEach(async () => {
    // Configure the mockConfigService.get before module compilation for safety
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'CHATGPT_API_KEY') return 'mock-api-key';
      if (key === 'CHATGPT_API_URL') return 'mock-api-url';
      return null;
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatgptController],
      providers: [
        { provide: ChatgptService, useValue: mockChatgptService },
        // Provide ConfigService mock to ensure that if the real ChatgptService
        // is momentarily considered by NestJS during module setup, it gets a mocked ConfigService.
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<ChatgptController>(ChatgptController);
    service = module.get<ChatgptService>(ChatgptService);
    configService = module.get<ConfigService>(ConfigService); // Add this
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('showChatInterface (GET /chatgpt)', () => {
    it('should return initial data for rendering the chat interface', async () => {
      const result = await controller.showChatInterface();
      expect(result).toEqual({
        prompt: null,
        response: null,
        error: null,
      });
    });
  });

  describe('getChatGptResponse (POST /chatgpt)', () => {
    const testPrompt = 'Test prompt';
    const dto: CreateChatCompletionRequestDto = { prompt: testPrompt };

    it('should call ChatgptService.fetchChatGptResponse and return prompt and response on success', async () => {
      const mockApiResponse = 'Mocked AI response';
      mockChatgptService.fetchChatGptResponse.mockResolvedValue(mockApiResponse);

      const result = await controller.getChatGptResponse(dto);

      expect(mockChatgptService.fetchChatGptResponse).toHaveBeenCalledWith(testPrompt);
      expect(result).toEqual({
        prompt: testPrompt,
        response: mockApiResponse,
        error: null,
      });
    });

    it('should return prompt and error message if service throws HttpException', async () => {
      const serviceError = new HttpException('Service Error XYZ', 500);
      mockChatgptService.fetchChatGptResponse.mockRejectedValue(serviceError);

      const result = await controller.getChatGptResponse(dto);

      expect(mockChatgptService.fetchChatGptResponse).toHaveBeenCalledWith(testPrompt);
      // The controller extracts the message from HttpException.getResponse()
      // If getResponse() returns a string, that's the error.
      // If it returns { message: '...', ...}, then error.message is used by controller.
      // For a simple new HttpException('Service Error XYZ', 500), getResponse() is { message: "Service Error XYZ", statusCode: 500 }
      expect(result).toEqual({
        prompt: testPrompt,
        response: null,
        error: 'Service Error XYZ',
      });
    });

    it('should return prompt and error message if service throws a non-HttpException', async () => {
      const genericError = new Error('Some unexpected generic error');
      mockChatgptService.fetchChatGptResponse.mockRejectedValue(genericError);

      const result = await controller.getChatGptResponse(dto);

      expect(mockChatgptService.fetchChatGptResponse).toHaveBeenCalledWith(testPrompt);
      expect(result).toEqual({
        prompt: testPrompt,
        response: null,
        error: 'Some unexpected generic error',
      });
    });
  });
});
