import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";

const tags = ["RSS"];

export const getRSSFeed = createRoute({
  path: "/rss.xml",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: {
      description: "RSS feed rendered as HTML",
    },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: {
      description: "Internal server error",
    },
  },
});


export type GetRSSFeedRoute = typeof getRSSFeed;