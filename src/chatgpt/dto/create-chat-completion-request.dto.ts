import { IsString, IsNotEmpty } from 'class-validator';

export class CreateChatCompletionRequestDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;
}
