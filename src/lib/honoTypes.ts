import { CreatePaymentIntentInput } from "./validators";

export type AppVariables = {
  validatedBody: CreatePaymentIntentInput;
  traceId: string;
  idempotencyKey: string;
};