import { NextRequest } from "next/server";
import { jsonResponse } from "@/lib/api/middleware";

import { handleGet } from "./actions/get";
import { handlePost } from "./actions/post";
import { handlePut } from "./actions/put";
import { handleDelete } from "./actions/delete";

export async function GET(req: NextRequest) {
  return handleGet(req);
}

export async function POST(req: NextRequest) {
  return handlePost(req);
}

export async function PUT(req: NextRequest) {
  return handlePut(req);
}

export async function DELETE(req: NextRequest) {
  return handleDelete(req);
}

export async function OPTIONS(req: NextRequest) {
  return jsonResponse({}, 200, req);
}
