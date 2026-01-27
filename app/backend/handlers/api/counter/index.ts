import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { IncrementClickUsecase } from "../../../domain/click/usecases/increment-click.usecase";
import { ClickCommandRepository } from "../../../infra/d1/click/click.command-repository";
import type { CounterResponse } from "~/lib/types/counter";

export const counterApp = new Hono<{ Bindings: Env }>()
  .get("/", async (c): Promise<Response> => {
    try {
      const db = drizzle(c.env.D1);
      const clickRepository = new ClickCommandRepository(db);
      const currentCount = await clickRepository.count();

      const response: CounterResponse = {
        count: currentCount,
      };

      return c.json(response);
    } catch (error) {
      console.error("Counter fetch error:", error);
      return c.json({ error: "Failed to fetch counter" }, 500);
    }
  })
  .post("/increment", async (c): Promise<Response> => {
    try {
      const db = drizzle(c.env.D1);
      const clickRepository = new ClickCommandRepository(db);
      const incrementClickUsecase = new IncrementClickUsecase(clickRepository);

      const result = await incrementClickUsecase.execute();

      const response: CounterResponse = {
        count: result.count,
      };

      return c.json(response);
    } catch (error) {
      console.error("Counter increment error:", error);
      return c.json({ error: "Failed to increment counter" }, 500);
    }
  });
