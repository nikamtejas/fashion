import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const NewsletterSubscriberSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  },
  { timestamps: true }
);

export type NewsletterSubscriberDoc = InferSchemaType<typeof NewsletterSubscriberSchema>;

export const NewsletterSubscriber: Model<NewsletterSubscriberDoc> =
  models.NewsletterSubscriber ??
  model<NewsletterSubscriberDoc>("NewsletterSubscriber", NewsletterSubscriberSchema);
