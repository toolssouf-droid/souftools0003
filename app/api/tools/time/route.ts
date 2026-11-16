import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentTimeInfo,
  convertTimeInfo,
  resolveLocationToTimeZone,
} from "@/lib/tools/timeEngine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action = "get_current_time", timezone, location, fromTimezone, toTimezone, dateTime } = body;

    if (action === "get_current_time") {
      const target = timezone || location || "Africa/Casablanca";
      const timeInfo = getCurrentTimeInfo(target);

      if (timeInfo.isAmbiguous) {
        return NextResponse.json({
          isAmbiguous: true,
          countryName: timeInfo.countryName,
          questionPrompt: timeInfo.questionPrompt,
          message: timeInfo.questionPrompt,
        });
      }

      return NextResponse.json({
        timezone: timeInfo.timezone,
        cityName: timeInfo.cityName,
        localTime: timeInfo.localTime,
        localTimeShort: timeInfo.localTimeShort,
        localDate: timeInfo.localDate,
        formattedDateAr: timeInfo.formattedDateAr,
        formattedDateEn: timeInfo.formattedDateEn,
        dayOfWeek: timeInfo.dayOfWeekAr,
        utcOffset: timeInfo.utcOffset,
        isDST: timeInfo.isDST,
      });
    }

    if (action === "convert_time") {
      if (!fromTimezone || !toTimezone) {
        return NextResponse.json(
          { error: "الرجاء تحديد المنطقة الزمنية المصدر والهدف" },
          { status: 400 }
        );
      }

      const conversion = convertTimeInfo(fromTimezone, toTimezone, dateTime);

      return NextResponse.json({
        fromTimezone: conversion.fromTimezone,
        toTimezone: conversion.toTimezone,
        fromLocationLabel: conversion.fromLocationLabel,
        toLocationLabel: conversion.toLocationLabel,
        originalTime: conversion.originalTime,
        convertedTime: conversion.convertedTime,
        convertedTimeShort: conversion.convertedTimeShort,
        convertedDate: conversion.convertedDate,
        convertedFormattedAr: conversion.convertedFormattedAr,
        convertedDayOfWeek: conversion.convertedDayOfWeekAr,
        fromUtcOffset: conversion.fromUtcOffset,
        toUtcOffset: conversion.toUtcOffset,
        fromIsDST: conversion.fromIsDST,
        toIsDST: conversion.toIsDST,
      });
    }

    return NextResponse.json({ error: "الإجراء غير معروف" }, { status: 400 });
  } catch (err: any) {
    console.error("Time API Route Error:", err);
    return NextResponse.json(
      { error: "حدث خطأ في جلب بيانات الوقت والمنطقة الزمنية" },
      { status: 500 }
    );
  }
}
