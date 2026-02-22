import { NextResponse } from "next/server";
import { SMS_TEMPLATES } from "@/lib/sms";

export async function GET() {
  return NextResponse.json({
    code: 200,
    message: "템플릿 조회 성공",
    data: SMS_TEMPLATES,
    meta: {
      testMode: process.env.ALIGO_TESTMODE !== "N",
    },
  });
}
