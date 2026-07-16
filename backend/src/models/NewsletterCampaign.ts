import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const NewsletterCampaignSchema = new Schema(
  {
    subject: { type: String, required: true },
    body: { type: String, required: true },
    recipientCount: { type: Number, required: true },
    sentBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export type NewsletterCampaignDoc = InferSchemaType<typeof NewsletterCampaignSchema>;

export const NewsletterCampaign: Model<NewsletterCampaignDoc> =
  models.NewsletterCampaign ?? model<NewsletterCampaignDoc>("NewsletterCampaign", NewsletterCampaignSchema);
