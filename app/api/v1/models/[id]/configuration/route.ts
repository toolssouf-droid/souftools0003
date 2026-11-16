// app/api/v1/models/[id]/configuration/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getModelById } from "@/lib/models/modelRegistry";
import { resolveAuthUser } from "@/lib/auth/serverAuth";

/**
 * GET & PATCH /api/v1/models/:id/configuration
 * Sanitized model configuration parameters.
 * Strictly NEVER exposes API keys, database URLs, or provider credentials.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const model = getModelById(id);

    if (!model) {
      return NextResponse.json(
        { success: false, error: "Model not found" },
        { status: 404 }
      );
    }

    const authUser = await resolveAuthUser(req);
    const isAdmin = authUser?.role === "admin" || authUser?.role === "super_admin";

    // Sanitized configuration parameters
    const safeConfiguration = {
      model_id: model.model_id,
      display_name: model.display_name,
      version: model.version,
      routing_priority: model.routing_priority,
      status: model.status,
      parameters: {
        default_temperature: model.configuration_schema.default_temperature,
        min_temperature: model.configuration_schema.min_temperature,
        max_temperature: model.configuration_schema.max_temperature,
        default_top_p: model.configuration_schema.default_top_p,
        supports_system_instructions: model.configuration_schema.supports_system_instructions,
        default_max_output_tokens: model.configuration_schema.default_max_output_tokens,
      },
      allowed_safety_thresholds: model.configuration_schema.allowed_safety_thresholds,
      canModify: isAdmin,
    };

    return NextResponse.json({
      success: true,
      configuration: safeConfiguration,
    });
  } catch (error: any) {
    console.error("Error in GET /api/v1/models/[id]/configuration:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const model = getModelById(id);

    if (!model) {
      return NextResponse.json(
        { success: false, error: "Model not found" },
        { status: 404 }
      );
    }

    const authUser = await resolveAuthUser(req);
    const isAdmin = authUser?.role === "admin" || authUser?.role === "super_admin";

    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          message: "فقط مشرفو النظام (Admins) يمتلكون صلاحية تعديل معلمات النموذج",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    // Prevent any attempts to pass or mutate secret keys
    if (body.apiKey || body.secret || body.databaseUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden parameter",
          message: "محاولة غير مسموح بها لتمرير أو تعديل مفاتيح سرية",
        },
        { status: 400 }
      );
    }

    // Validate and update allowable runtime parameters
    if (typeof body.temperature === "number") {
      model.configuration_schema.default_temperature = Math.min(1.0, Math.max(0.0, body.temperature));
    }
    if (typeof body.topP === "number") {
      model.configuration_schema.default_top_p = Math.min(1.0, Math.max(0.1, body.topP));
    }
    if (typeof body.maxOutputTokens === "number") {
      model.configuration_schema.default_max_output_tokens = Math.min(
        model.limits.max_output_tokens,
        Math.max(256, body.maxOutputTokens)
      );
    }

    return NextResponse.json({
      success: true,
      message: "تم تحديث معلمات النموذج بنجاح",
      updatedParameters: {
        default_temperature: model.configuration_schema.default_temperature,
        default_top_p: model.configuration_schema.default_top_p,
        default_max_output_tokens: model.configuration_schema.default_max_output_tokens,
      },
    });
  } catch (error: any) {
    console.error("Error in PATCH /api/v1/models/[id]/configuration:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
