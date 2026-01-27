import { Click } from "../click.entity";
import type { IClickCommandRepository } from "../click.command-repository.interface";

export class IncrementClickUsecase {
  constructor(private readonly clickRepository: IClickCommandRepository) {}

  async execute(): Promise<{ count: number }> {
    const click = Click.create({ timestamp: Date.now() });
    await this.clickRepository.save(click);
    const count = await this.clickRepository.count();
    return { count };
  }
}
