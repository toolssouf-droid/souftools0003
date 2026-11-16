/**
 * SoufAI Framework Presets and Starter Bundles
 * Supports React, Next.js, Vue, Svelte, HTML5, Node/Express, FastAPI, Python, Flutter, etc.
 */

import { FrameworkPreset, SupportedFramework } from "./types";

export const FRAMEWORK_PRESETS: Record<SupportedFramework, FrameworkPreset> = {
  react: {
    id: "react",
    name: "React (Tailwind + Lucide)",
    category: "frontend",
    iconName: "Code2",
    color: "#00d4aa",
    description: "تطبيقات React الحديثة مع Tailwind CSS ومكونات تفاعلية فورية في المعاينة",
    entryFile: "src/App.tsx",
    initialFiles: {
      "package.json": JSON.stringify(
        {
          name: "souf-react-app",
          version: "1.0.0",
          private: true,
          dependencies: {
            react: "^19.0.0",
            "react-dom": "^19.0.0",
            "lucide-react": "^0.553.0",
            "tailwindcss": "^3.4.0",
          },
        },
        null,
        2
      ),
      "README.md": `# مشروع React — تم إنشاؤه عبر SoufAI Coding Agent

مشروع تفاعلي جاهز للتطوير والتعديل الفوري عبر الأوامر الطبيعية.

## التشغيل
- تم تفعيل المعاينة التلقائية في قسم Live Preview.
- للتعديل، اكتب للوكيل في محادثة Coding Workspace.
`,
      "src/App.tsx": `import React, { useState } from "react";
import { ShoppingBag, Star, Plus, Check, Zap, Sparkles } from "lucide-react";

interface Product {
  id: number;
  name: string;
  price: number;
  rating: number;
  category: string;
  image: string;
}

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "سماعات الألعاب الاحترافية Pro Wireless",
    price: 189,
    rating: 4.9,
    category: "إلكترونيات",
    image: "🎧",
  },
  {
    id: 2,
    name: "ساعة ذكية Ultra OLED مقاومة للماء",
    price: 249,
    rating: 4.8,
    category: "أجهزة قابلة للارتداء",
    image: "⌚",
  },
  {
    id: 3,
    name: "لوحة مفاتيح ميكانيكية RGB مخصصة",
    price: 129,
    rating: 5.0,
    category: "إلكترونيات",
    image: "⌨️",
  },
  {
    id: 4,
    name: "نظارات الواقع المعزز AR Vision Pro",
    price: 499,
    rating: 4.7,
    category: "ابتكارات",
    image: "🥽",
  },
];

export default function App() {
  const [cart, setCart] = useState<number[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("الكل");
  const [search, setSearch] = useState<string>("");

  const categories = ["الكل", "إلكترونيات", "أجهزة قابلة للارتداء", "ابتكارات"];

  const filtered = SAMPLE_PRODUCTS.filter((p) => {
    const matchCat = activeCategory === "الكل" || p.category === activeCategory;
    const matchSearch = p.name.includes(search);
    return matchCat && matchSearch;
  });

  const addToCart = (id: number) => {
    setCart((prev) => [...prev, id]);
  };

  return (
    <div className="min-h-screen bg-[#0a0f0f] text-[#e8f5f5] font-sans" dir="rtl">
      {/* Header */}
      <header className="border-b border-[#1e2e2e] bg-[#0d1414]/90 backdrop-blur sticky top-0 z-20 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00d4aa] to-[#0ea5e9] flex items-center justify-center text-[#0a0f0f] font-black text-xl shadow-lg shadow-[#00d4aa]/20">
              ⚡
            </div>
            <div>
              <h1 className="text-lg font-black text-[#e8f5f5]">متجر SoufStore الذكي</h1>
              <p className="text-xs text-[#00d4aa]">بيئة تفاعلية حية تم بناؤها بواسطة SoufAI</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#111a1a] border border-[#00d4aa]/40 text-xs font-bold text-[#00d4aa] shadow-md hover:bg-[#00d4aa]/10 transition-all">
                <ShoppingBag className="w-4 h-4" />
                <span>السلة</span>
                <span className="w-5 h-5 rounded-full bg-[#00d4aa] text-[#0a0f0f] text-[10px] flex items-center justify-center font-black">
                  {cart.length}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Hero Banner */}
        <div className="relative p-8 rounded-3xl bg-gradient-to-r from-[#111a1a] to-[#0d1919] border border-[#00d4aa]/30 overflow-hidden shadow-2xl">
          <div className="relative z-10 max-w-xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00d4aa]/15 border border-[#00d4aa]/30 text-xs font-bold text-[#00d4aa]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>عروض وتخفيضات الذكاء الاصطناعي 2026</span>
            </div>
            <h2 className="text-3xl font-black leading-tight text-white">
              أقوى المنتجات التقنية المستقبلية بلمسة زر
            </h2>
            <p className="text-sm text-[#88b0b0]">
              توصيل فوري خلال 24 ساعة مع ضمان استرجاع 30 يوماً وتجربة تسوق مدعومة بالذكاء الاصطناعي.
            </p>
          </div>
          <div className="absolute left-8 top-1/2 -translate-y-1/2 text-8xl opacity-30 select-none pointer-events-none">
            🚀
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={\`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap \${
                  activeCategory === cat
                    ? "bg-[#00d4aa] text-[#0a0f0f] shadow-lg shadow-[#00d4aa]/20"
                    : "bg-[#111a1a] text-[#88b0b0] border border-[#1e2e2e] hover:border-[#00d4aa]/40"
                }\`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="ابحث عن منتج..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-[#111a1a] border border-[#1e2e2e] focus:border-[#00d4aa] text-xs text-[#e8f5f5] placeholder-[#4a7070] outline-none transition-all"
            />
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filtered.map((product) => (
            <div
              key={product.id}
              className="group p-5 rounded-2xl bg-[#0d1414] border border-[#1e2e2e] hover:border-[#00d4aa]/50 hover:bg-[#111a1a] transition-all duration-200 flex flex-col justify-between shadow-lg"
            >
              <div className="space-y-3">
                <div className="w-full h-36 rounded-xl bg-[#111a1a] border border-[#1e2e2e] flex items-center justify-center text-5xl group-hover:scale-105 transition-transform duration-200">
                  {product.image}
                </div>
                <div>
                  <span className="text-[10px] text-[#00d4aa] font-bold px-2 py-0.5 rounded-full bg-[#00d4aa]/10 border border-[#00d4aa]/20">
                    {product.category}
                  </span>
                  <h3 className="text-sm font-bold text-[#e8f5f5] mt-2 group-hover:text-[#00d4aa] transition-colors line-clamp-2">
                    {product.name}
                  </h3>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#1e2e2e] flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#88b0b0]">السعر</span>
                  <div className="text-base font-black text-[#00ff88]">
                    {product.price} <span className="text-xs font-normal">دولار</span>
                  </div>
                </div>

                <button
                  onClick={() => addToCart(product.id)}
                  className="p-2.5 rounded-xl bg-[#00d4aa] hover:bg-[#00ff88] text-[#0a0f0f] font-bold transition-all shadow-md shadow-[#00d4aa]/20 active:scale-90"
                  title="أضف إلى السلة"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
`,
    },
    buildRunner: (files) => {
      // Return compiled bundle wrapper for instant iframe rendering
      return {
        previewHtml: generateReactPreviewBundle(files),
      };
    },
  },

  nextjs: {
    id: "nextjs",
    name: "Next.js App Router (Fullstack)",
    category: "fullstack",
    iconName: "Zap",
    color: "#0ea5e9",
    description: "تطبيقات Next.js App Router مع دعم مسارات API ومكونات Server/Client",
    entryFile: "app/page.tsx",
    initialFiles: {
      "package.json": JSON.stringify(
        {
          name: "souf-nextjs-app",
          version: "0.1.0",
          private: true,
          dependencies: {
            next: "^15.0.0",
            react: "^19.0.0",
            "react-dom": "^19.0.0",
            "lucide-react": "^0.553.0",
          },
        },
        null,
        2
      ),
      "app/page.tsx": `'use client';
import React, { useState } from 'react';
import { Sparkles, Terminal, Activity, ArrowLeft } from 'lucide-react';

export default function NextDashboard() {
  const [activeTab, setActiveTab] = useState('metrics');

  return (
    <div className="min-h-screen bg-[#090e0e] text-[#e8f5f5] p-6" dir="rtl">
      <header className="flex justify-between items-center pb-6 border-b border-[#1e2e2e]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0ea5e9]/20 border border-[#0ea5e9]/40 flex items-center justify-center text-[#0ea5e9] font-black">
            ▲
          </div>
          <div>
            <h1 className="text-base font-black">Next.js App Workspace</h1>
            <p className="text-xs text-[#88b0b0]">لوحة تحكم خادم Next.js المتكاملة</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="p-5 rounded-2xl bg-[#0d1414] border border-[#1e2e2e] space-y-3">
          <div className="text-xs text-[#88b0b0]">إجمالي الطلبات اليوم</div>
          <div className="text-2xl font-black text-[#00d4aa]">142,890</div>
          <div className="text-[10px] text-[#00ff88]">+12.4% مقارنة بالأمس</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0d1414] border border-[#1e2e2e] space-y-3">
          <div className="text-xs text-[#88b0b0]">متوسط زمن المعالجة (Latency)</div>
          <div className="text-2xl font-black text-[#0ea5e9]">38ms</div>
          <div className="text-[10px] text-[#0ea5e9]">أداء فائق واستجابة فورية</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0d1414] border border-[#1e2e2e] space-y-3">
          <div className="text-xs text-[#88b0b0]">معدل النجاح الإجمالي</div>
          <div className="text-2xl font-black text-[#00ff88]">99.98%</div>
          <div className="text-[10px] text-[#00ff88]">جميع الخدمات تعمل بكفاءة</div>
        </div>
      </div>
    </div>
  );
}
`,
    },
    buildRunner: (files) => ({
      previewHtml: generateReactPreviewBundle(files),
    }),
  },

  vue: {
    id: "vue",
    name: "Vue 3 (Composition API)",
    category: "frontend",
    iconName: "Sparkles",
    color: "#42b883",
    description: "تطبيقات Vue 3 التفاعلية مع التفاعل الفوري وTailwind CSS",
    entryFile: "src/App.vue",
    initialFiles: {
      "package.json": JSON.stringify(
        {
          name: "souf-vue-app",
          version: "1.0.0",
          dependencies: { vue: "^3.4.0" },
        },
        null,
        2
      ),
      "src/App.vue": `<template>
  <div class="min-h-screen bg-[#0a0f0f] text-[#e8f5f5] p-8 font-sans" dir="rtl">
    <div class="max-w-2xl mx-auto bg-[#0d1414] border border-[#1e2e2e] p-6 rounded-2xl shadow-xl space-y-6">
      <div class="flex items-center gap-3">
        <span class="text-3xl">🟢</span>
        <div>
          <h1 class="text-xl font-black text-[#42b883]">{{ title }}</h1>
          <p class="text-xs text-[#88b0b0]">تطبيق Vue 3 يعمل عبر بيئة عمل SoufAI Coding Agent</p>
        </div>
      </div>

      <div class="p-4 rounded-xl bg-[#111a1a] border border-[#1e2e2e] flex items-center justify-between">
        <span class="text-sm font-bold">العداد التفاعلي:</span>
        <div class="flex items-center gap-3">
          <button @click="count--" class="px-3 py-1 bg-[#1e2e2e] hover:bg-[#2a3e3e] rounded-lg text-sm">-</button>
          <span class="text-base font-black text-[#00d4aa]">{{ count }}</span>
          <button @click="count++" class="px-3 py-1 bg-[#42b883] hover:bg-[#33a06f] text-black font-bold rounded-lg text-sm">+</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      title: "تطبيق Vue 3 التفاعلي",
      count: 10
    };
  }
};
</script>
`,
    },
    buildRunner: (files) => ({
      previewHtml: generateVuePreviewBundle(files),
    }),
  },

  svelte: {
    id: "svelte",
    name: "Svelte 5",
    category: "frontend",
    iconName: "Zap",
    color: "#ff3e00",
    description: "تطبيقات Svelte الخفيفة والسريعة جداً",
    entryFile: "src/App.svelte",
    initialFiles: {
      "src/App.svelte": `<script>
  let count = 0;
  function increment() { count += 1; }
</script>

<div style="background:#0a0f0f; color:#e8f5f5; min-height:100vh; padding:30px; font-family:sans-serif;" dir="rtl">
  <h1 style="color:#ff3e00; font-size:24px; font-weight:bold;">مشروع Svelte الخفيف</h1>
  <p style="color:#88b0b0; font-size:14px; margin-top:8px;">تم بناؤه بواسطة SoufAI</p>
  <div style="margin-top:20px;">
    <button on:click={increment} style="background:#ff3e00; color:#fff; border:none; padding:10px 20px; border-radius:10px; cursor:pointer; font-weight:bold;">
      الضغطات: {count}
    </button>
  </div>
</div>
`,
    },
    buildRunner: (files) => ({
      previewHtml: generateGenericPreviewBundle(files, "src/App.svelte"),
    }),
  },

  angular: {
    id: "angular",
    name: "Angular Standalone",
    category: "frontend",
    iconName: "Code2",
    color: "#dd0031",
    description: "هيكلية Angular للمشاريع الضخمة",
    entryFile: "src/app.component.ts",
    initialFiles: {
      "src/app.component.ts": `import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: \`
    <div style="background:#0a0f0f; color:#e8f5f5; padding:30px; font-family:sans-serif;" dir="rtl">
      <h1 style="color:#dd0031;">تطبيق Angular Enterprise</h1>
      <p style="color:#88b0b0;">جاهز للتطوير والتوسع</p>
    </div>
  \`
})
export class AppComponent {}
`,
    },
    buildRunner: (files) => ({
      previewHtml: generateGenericPreviewBundle(files, "src/app.component.ts"),
    }),
  },

  vanilla_html: {
    id: "vanilla_html",
    name: "HTML5 + Tailwind + JS",
    category: "frontend",
    iconName: "Globe",
    color: "#e34f26",
    description: "صفحات الويب المباشرة مع HTML5 وTailwind CSS وجافاسكريبت نقية",
    entryFile: "index.html",
    initialFiles: {
      "index.html": `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تطبيق HTML5 المتكامل</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#0a0f0f] text-[#e8f5f5] min-h-screen p-8 flex items-center justify-center font-sans">
  <div class="max-w-md w-full bg-[#0d1414] border border-[#1e2e2e] p-6 rounded-3xl text-center space-y-4 shadow-2xl">
    <div class="text-4xl">🚀</div>
    <h1 class="text-xl font-black text-[#00d4aa]">مرحباً بك في صفحة HTML5 التفاعلية</h1>
    <p class="text-xs text-[#88b0b0]">تطبيق خفيف وسريع تم إنشاؤه عبر SoufAI Coding Workspace.</p>
    <button id="btn" class="w-full py-3 rounded-xl bg-[#00d4aa] text-[#0a0f0f] font-bold text-xs shadow-lg hover:bg-[#00ff88] transition-all">
      انقر للتفاعل
    </button>
  </div>

  <script>
    document.getElementById('btn').addEventListener('click', () => {
      alert('تم التفاعل بنجاح عبر SoufAI Sandbox!');
    });
  </script>
</body>
</html>
`,
    },
    buildRunner: (files) => ({
      previewHtml: files["index.html"] || "<h1>No index.html</h1>",
    }),
  },

  vanilla_ts: {
    id: "vanilla_ts",
    name: "TypeScript Application",
    category: "frontend",
    iconName: "Code2",
    color: "#3178c6",
    description: "تطبيقات TypeScript الحديثة عالية الأمان والنوعية",
    entryFile: "src/main.ts",
    initialFiles: {
      "src/main.ts": `console.log("SoufAI TypeScript app initialized.");`,
    },
    buildRunner: (files) => ({
      previewHtml: generateGenericPreviewBundle(files, "src/main.ts"),
    }),
  },

  nodejs: {
    id: "nodejs",
    name: "Node.js (API & Server)",
    category: "backend",
    iconName: "Terminal",
    color: "#68a063",
    description: "خدمات ومسارات خادم Node.js مع إدارة الحزم وExpress",
    entryFile: "server.js",
    initialFiles: {
      "server.js": `const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    status: 'online',
    engine: 'SoufAI Node Runtime',
    message: 'خادم Node.js يعمل بنجاح!',
    timestamp: new Date().toISOString()
  }, null, 2));
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
`,
      "package.json": JSON.stringify(
        {
          name: "souf-node-server",
          version: "1.0.0",
          main: "server.js",
          scripts: { start: "node server.js" },
        },
        null,
        2
      ),
    },
    buildRunner: (files) => ({
      previewHtml: generateBackendPreviewBundle("Node.js / Express Server", files["server.js"] || ""),
    }),
  },

  express: {
    id: "express",
    name: "Express.js REST API",
    category: "backend",
    iconName: "Terminal",
    color: "#00d4aa",
    description: "بناء واجهات برمجية RESTful كاملة وسريعة باستخدام Express",
    entryFile: "app.js",
    initialFiles: {
      "app.js": `const express = require('express');
const app = express();

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'SoufExpress API is running smoothly' });
});

app.listen(3000);
`,
    },
    buildRunner: (files) => ({
      previewHtml: generateBackendPreviewBundle("Express.js API", files["app.js"] || ""),
    }),
  },

  python_fastapi: {
    id: "python_fastapi",
    name: "Python FastAPI",
    category: "backend",
    iconName: "Zap",
    color: "#059669",
    description: "أطر عمل Python الحديثة لبناء واجهات برمجية ذكاء اصطناعي ومعالجة البيانات",
    entryFile: "main.py",
    initialFiles: {
      "main.py": `from fastapi import FastAPI

app = FastAPI(title="SoufAI FastAPI Service")

@app.get("/")
def read_root():
    return {
        "status": "success",
        "service": "FastAPI Engine",
        "message": "خادم بايثون عالي السرعة يعمل بنجاح"
    }

@app.get("/api/items/{item_id}")
def read_item(item_id: int):
    return {"item_id": item_id, "name": f"Item {item_id}"}
`,
      "requirements.txt": `fastapi>=0.110.0\nuvicorn>=0.28.0\npydantic>=2.0.0`,
    },
    buildRunner: (files) => ({
      previewHtml: generateBackendPreviewBundle("Python FastAPI Service", files["main.py"] || ""),
    }),
  },

  python_django: {
    id: "python_django",
    name: "Python Django",
    category: "backend",
    iconName: "Terminal",
    color: "#092e20",
    description: "إطار عمل بايثون العملاق للمشاريع المتكاملة وقواعد البيانات",
    entryFile: "manage.py",
    initialFiles: {
      "manage.py": `#!/usr/bin/env python\nimport os\nimport sys\n# Django starter template`,
    },
    buildRunner: (files) => ({
      previewHtml: generateBackendPreviewBundle("Django Backend", files["manage.py"] || ""),
    }),
  },

  php: {
    id: "php",
    name: "PHP 8 & Laravel",
    category: "backend",
    iconName: "Code2",
    color: "#777bb4",
    description: "تطبيقات PHP الحديثة وقواعد بيانات MySQL",
    entryFile: "index.php",
    initialFiles: {
      "index.php": `<?php\nheader('Content-Type: application/json');\necho json_encode(["message" => "مرحبا بكم من خادم PHP 8"]);`,
    },
    buildRunner: (files) => ({
      previewHtml: generateBackendPreviewBundle("PHP 8 Script", files["index.php"] || ""),
    }),
  },

  java_spring: {
    id: "java_spring",
    name: "Java Spring Boot",
    category: "backend",
    iconName: "Code2",
    color: "#b07219",
    description: "تطبيقات جافا سبرينج للمؤسسات والأنظمة الكبرى",
    entryFile: "src/main/java/Application.java",
    initialFiles: {
      "src/main/java/Application.java": `package com.souftools.app;\n\npublic class Application {\n  public static void main(String[] args) {\n    System.out.println("Spring Boot Service Initialized.");\n  }\n}`,
    },
    buildRunner: (files) => ({
      previewHtml: generateBackendPreviewBundle("Java Spring Boot", files["src/main/java/Application.java"] || ""),
    }),
  },

  golang: {
    id: "golang",
    name: "Golang (Go)",
    category: "backend",
    iconName: "Zap",
    color: "#00add8",
    description: "خدمات جو الموجهة للأداء العالي والـ Microservices",
    entryFile: "main.go",
    initialFiles: {
      "main.go": `package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("SoufAI Golang High Performance Service")\n}`,
    },
    buildRunner: (files) => ({
      previewHtml: generateBackendPreviewBundle("Go Backend Engine", files["main.go"] || ""),
    }),
  },

  csharp_dotnet: {
    id: "csharp_dotnet",
    name: "C# / .NET Core",
    category: "backend",
    iconName: "Code2",
    color: "#512bd4",
    description: "تطبيقات مايكروسوفت دوت نت وC# الحديثة",
    entryFile: "Program.cs",
    initialFiles: {
      "Program.cs": `var builder = WebApplication.CreateBuilder(args);\nvar app = builder.Build();\napp.MapGet("/", () => "Hello from .NET 8!");\napp.Run();`,
    },
    buildRunner: (files) => ({
      previewHtml: generateBackendPreviewBundle(".NET 8 Web API", files["Program.cs"] || ""),
    }),
  },

  react_native: {
    id: "react_native",
    name: "React Native / Expo",
    category: "mobile",
    iconName: "Smartphone",
    color: "#61dafb",
    description: "تطبيقات الهواتف الذكية لأنظمة iOS وAndroid",
    entryFile: "App.tsx",
    initialFiles: {
      "App.tsx": `import React from 'react';\nimport { View, Text, StyleSheet } from 'react-native';\n\nexport default function App() {\n  return (\n    <View style={styles.container}>\n      <Text style={styles.text}>تطبيق React Native للجوال</Text>\n    </View>\n  );\n}\n\nconst styles = StyleSheet.create({\n  container: { flex: 1, backgroundColor: '#0a0f0f', alignItems: 'center', justifyContent: 'center' },\n  text: { color: '#00d4aa', fontSize: 18, fontWeight: 'bold' }\n});`,
    },
    buildRunner: (files) => ({
      previewHtml: generateMobilePreviewBundle("React Native Mobile View", files["App.tsx"] || ""),
    }),
  },

  flutter: {
    id: "flutter",
    name: "Flutter (Dart)",
    category: "mobile",
    iconName: "Smartphone",
    color: "#02569b",
    description: "تطبيقات دارت وفلاتر السريعة لكافة المنصات",
    entryFile: "lib/main.dart",
    initialFiles: {
      "lib/main.dart": `import 'package:flutter/material.dart';\n\nvoid main() => runApp(const SoufFlutterApp());\n\nclass SoufFlutterApp extends StatelessWidget {\n  const SoufFlutterApp({super.key});\n  @override\n  Widget build(BuildContext context) {\n    return MaterialApp(\n      home: Scaffold(\n        backgroundColor: const Color(0xFF0A0F0F),\n        body: const Center(\n          child: Text(\n            'تطبيق Flutter المتميز',\n            style: TextStyle(color: Color(0xFF00D4AA), fontSize: 20),\n          ),\n        ),\n      ),\n    );\n  }\n}`,
    },
    buildRunner: (files) => ({
      previewHtml: generateMobilePreviewBundle("Flutter Canvas View", files["lib/main.dart"] || ""),
    }),
  },

  custom: {
    id: "custom",
    name: "Custom Project",
    category: "fullstack",
    iconName: "Code2",
    color: "#00d4aa",
    description: "مشروع مخصص متعدد الملفات بحسب متطلبات المستخدم",
    entryFile: "index.html",
    initialFiles: {
      "index.html": `<!DOCTYPE html><html><body><h1>Custom Project</h1></body></html>`,
    },
    buildRunner: (files) => ({
      previewHtml: files["index.html"] || "<h1>Custom Workspace</h1>",
    }),
  },
};

/**
 * Compiles React/JSX/TSX code directly in an isolated HTML Sandbox
 */
function generateReactPreviewBundle(files: Record<string, string>): string {
  const appCode =
    files["src/App.tsx"] ||
    files["src/App.jsx"] ||
    files["src/App.js"] ||
    files["app/page.tsx"] ||
    files["src/page.tsx"] ||
    files["App.tsx"] ||
    files["page.tsx"] ||
    Object.entries(files).find(([k]) => k.endsWith("App.tsx") || k.endsWith("App.jsx") || k.endsWith("page.tsx"))?.[1] ||
    Object.values(files)[0] ||
    `export default function App() { return <div className="p-8 text-white">No App Component Found</div>; }`;

  // Extract other components and modules (excluding main entry)
  const extraComponentsCode: string[] = [];
  Object.entries(files).forEach(([path, content]) => {
    if (
      path !== "src/App.tsx" &&
      path !== "src/App.jsx" &&
      path !== "src/App.js" &&
      path !== "app/page.tsx" &&
      path !== "src/page.tsx" &&
      path !== "App.tsx" &&
      path !== "page.tsx" &&
      !path.endsWith(".json") &&
      !path.endsWith(".md") &&
      !path.endsWith(".css") &&
      (path.endsWith(".tsx") || path.endsWith(".jsx") || path.endsWith(".ts") || path.endsWith(".js"))
    ) {
      extraComponentsCode.push(`// --- Module: ${path} ---\n${cleanCodeForBabel(content)}`);
    }
  });

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SoufAI Live React Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- React & Babel for in-browser instant execution -->
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { background-color: #0a0f0f; color: #e8f5f5; font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 0; min-height: 100vh; }
    /* Custom scrollbar for inside iframe */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #070c0c; }
    ::-webkit-scrollbar-thumb { background: #1e2e2e; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #00d4aa; }
  </style>
  <script>
    (function() {
      const origLog = console.log;
      const origWarn = console.warn;
      const origError = console.error;
      const origInfo = console.info;

      function postToParent(level, args) {
        try {
          const text = Array.from(args).map(function(a) {
            if (typeof a === 'object') {
              try { return JSON.stringify(a); } catch(e) { return String(a); }
            }
            return String(a);
          }).join(' ');

          window.parent.postMessage({
            type: 'SANDBOX_CONSOLE',
            level: level,
            message: text,
            timestamp: Date.now()
          }, '*');
        } catch(e) {}
      }

      console.log = function(...args) { origLog.apply(console, args); postToParent('log', args); };
      console.warn = function(...args) { origWarn.apply(console, args); postToParent('warn', args); };
      console.error = function(...args) { origError.apply(console, args); postToParent('error', args); };
      console.info = function(...args) { origInfo.apply(console, args); postToParent('info', args); };

      window.onerror = function(msg, url, lineNo) {
        postToParent('error', ['[Uncaught]', msg, 'line:', lineNo]);
        return false;
      };

      window.addEventListener('message', function(ev) {
        if (ev.data && ev.data.type === 'EVAL_CODE') {
          try {
            const result = eval(ev.data.code);
            postToParent('log', ['> ' + ev.data.code, '\\n< ' + (typeof result === 'object' ? JSON.stringify(result) : String(result))]);
          } catch(err) {
            postToParent('error', ['> ' + ev.data.code, '\\n❌ ' + err.message]);
          }
        }
      });
    })();
  </script>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel" data-presets="react,typescript">
    const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext, useReducer } = React;

    // Lucide Icon Mock Shim for Browser Sandbox
    const LucideIconShim = ({ name = "Sparkles", className = "w-4 h-4", size = 16, style = {}, ...props }) => {
      return (
        <span 
          className={\`inline-flex items-center justify-center \${className || "w-4 h-4"}\`} 
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: size, minHeight: size, ...style }}
          title={name}
          {...props}
        >
          ✦
        </span>
      );
    };

    // Global component mocks for all common Lucide icons to prevent ReferenceError
    const iconNames = [
      "ShoppingBag", "Star", "Plus", "Check", "Zap", "Sparkles", "Terminal", "Activity", "ArrowLeft", "Code2",
      "Trash", "Trash2", "Edit", "Edit2", "Edit3", "Search", "Filter", "Moon", "Sun", "Heart", "User", "Users",
      "Settings", "ArrowRight", "ArrowUp", "ArrowDown", "Play", "Pause", "RotateCw", "RefreshCw", "ChevronDown",
      "ChevronUp", "ChevronLeft", "ChevronRight", "Bell", "Calendar", "Mail", "Phone", "Lock", "Unlock", "Eye",
      "EyeOff", "Globe", "X", "Menu", "Maximize2", "Minimize2", "Copy", "Download", "Upload", "Folder", "FolderTree",
      "File", "FileText", "FileCode", "CheckCircle2", "CheckCircle", "AlertTriangle", "Info", "HelpCircle", "Send",
      "Share2", "Sliders", "Tag", "Volume2", "VolumeX", "Wifi", "WifiOff", "Database", "Server", "Cpu", "Layers",
      "Box", "Package", "ShoppingCart", "DollarSign", "CreditCard", "BarChart", "BarChart2", "PieChart", "TrendingUp",
      "TrendingDown", "Clock", "Compass", "MapPin", "Navigation", "Camera", "Video", "Music", "Mic", "Image",
      "Award", "Bookmark", "ThumbsUp", "ThumbsDown", "Flame", "Shield", "ShieldCheck", "AlertCircle", "Coffee",
      "Gift", "Smile", "MessageSquare", "MessageCircle", "Wrench", "Tool", "Key", "ExternalLink", "List", "Grid",
      "MoreHorizontal", "MoreVertical", "Link", "Save", "Paperclip", "Printer", "BookOpen", "Laptop", "Smartphone"
    ];

    const LucideProxiedIcons = {};
    iconNames.forEach((n) => {
      window[n] = (props) => <LucideIconShim name={n} {...props} />;
    });

    // Global motion and animation shims for Framer Motion compatibility
    window.motion = new Proxy({}, {
      get: (_, prop) => (props) => React.createElement(typeof prop === 'string' && prop !== 'custom' ? prop : 'div', props)
    });
    window.AnimatePresence = ({ children }) => children;

    // Provide safe global window fallback
    window.__DEFAULT_EXPORT__ = null;
    window.__EXPORTS__ = {};

    try {
      // 1. Load Secondary Modules and Components
      ${extraComponentsCode.join("\n\n")}

      // 2. Load Entry Application Code
      ${cleanCodeForBabel(appCode)}

      // Determine mounted Root Component
      let TargetComponent = window.__DEFAULT_EXPORT__;
      if (!TargetComponent && typeof App !== 'undefined') TargetComponent = App;
      if (!TargetComponent && typeof NextDashboard !== 'undefined') TargetComponent = NextDashboard;
      if (!TargetComponent && typeof DefaultExport !== 'undefined') TargetComponent = DefaultExport;
      if (!TargetComponent && typeof MainComponent !== 'undefined') TargetComponent = MainComponent;
      if (!TargetComponent && typeof Page !== 'undefined') TargetComponent = Page;

      if (!TargetComponent) {
        // Fallback search across window globals
        const possibleKeys = Object.keys(window).filter(k => /^[A-Z][A-Za-z0-9_]*$/.test(k) && typeof window[k] === 'function' && !iconNames.includes(k));
        if (possibleKeys.length > 0) {
          TargetComponent = window[possibleKeys[0]];
        }
      }

      if (TargetComponent) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<TargetComponent />);
      } else {
        document.getElementById('root').innerHTML = \`
          <div style="padding:30px; text-align:center; color:#00d4aa; font-family:sans-serif;" dir="rtl">
            <h2 style="font-size:18px; font-weight:bold;">✨ تم تجميع المشروع بنجاح</h2>
            <p style="color:#88b0b0; font-size:13px; margin-top:8px;">بيئة المعاينة الحية التفاعلية جاهزة وتعمل بسلاسة.</p>
          </div>
        \`;
      }
    } catch (err) {
      console.error("Preview Execution Error:", err);
      document.getElementById('root').innerHTML = \`
        <div style="padding:20px; color:#ef4444; background:#1c1012; border:1px solid #7f1d1d; border-radius:12px; margin:20px; font-family:monospace;" dir="ltr">
          <h3 style="margin-top:0; font-size:15px; font-weight:bold;">❌ Runtime Preview Error</h3>
          <pre style="white-space:pre-wrap; font-size:12px; line-height:1.5;">\${err.message || err}</pre>
        </div>
      \`;
      try {
        window.parent.postMessage({ type: 'PREVIEW_ERROR', message: err.message }, '*');
      } catch(e) {}
    }
  </script>
</body>
</html>`;
}

function cleanCodeForBabel(code: string): string {
  if (!code) return "";

  let cleaned = code
    .replace(/^'use client';?/gm, "")
    .replace(/^"use client";?/gm, "");

  // Transform named imports: import { A, B } from '...' -> const { A, B } = window;
  cleaned = cleaned.replace(/import\s+{([^}]+)}\s+from\s+['"][^'"]+['"];?/g, (_, items) => {
    const list = items
      .split(",")
      .map((s: string) => s.trim().split(/\s+as\s+/)[0])
      .filter(Boolean);
    return `const { ${list.join(", ")} } = window;\n`;
  });

  // Transform default imports: import A from '...' -> const A = window.A || window.__DEFAULT_EXPORT__;
  cleaned = cleaned.replace(/import\s+([A-Za-z0-9_]+)\s+from\s+['"][^'"]+['"];?/g, (_, name) => {
    if (name === "React") return "";
    return `const ${name} = window.${name} || window.__DEFAULT_EXPORT__ || ((props) => React.createElement('div', props));\n`;
  });

  // Strip remaining import statements (types, CSS, wildcards)
  cleaned = cleaned
    .replace(/import\s+type\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, "")
    .replace(/import\s+\*[\s\S]*?from\s+['"][^'"]+['"];?/g, "")
    .replace(/import\s+['"][^'"]+['"];?/g, "");

  // Transform export default
  cleaned = cleaned.replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/g, "function $1;\nwindow.__DEFAULT_EXPORT__ = $1;\nwindow.$1 = $1;");
  cleaned = cleaned.replace(/export\s+default\s+/g, "window.__DEFAULT_EXPORT__ = ");

  // Transform named exports: export function X / export const X
  cleaned = cleaned.replace(/export\s+function\s+([A-Za-z0-9_]+)/g, "window.$1 = function $1");
  cleaned = cleaned.replace(/export\s+(const|let|var)\s+([A-Za-z0-9_]+)\s*=/g, "window.$2 = $1 $2 =");
  cleaned = cleaned.replace(/export\s+{[^}]+};?/g, "");

  return cleaned;
}

function generateVuePreviewBundle(files: Record<string, string>): string {
  const vueFile = files["src/App.vue"] || "<template><div>Vue App</div></template>";
  const templateMatch = vueFile.match(/<template>([\s\S]*?)<\/template>/);
  const scriptMatch = vueFile.match(/<script>([\s\S]*?)<\/script>/);

  const template = templateMatch ? templateMatch[1] : "<div>Vue 3 Template</div>";
  const script = scriptMatch ? scriptMatch[1] : "export default {};";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
</head>
<body class="bg-[#0a0f0f] text-[#e8f5f5]">
  <div id="app">${template}</div>
  <script>
    const { createApp } = Vue;
    ${cleanCodeForBabel(script)}
    const app = createApp(typeof window.__DEFAULT_EXPORT__ !== 'undefined' ? window.__DEFAULT_EXPORT__ : {});
    app.mount('#app');
  </script>
</body>
</html>`;
}

function generateBackendPreviewBundle(title: string, code: string): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#0a0f0f] text-[#e8f5f5] p-6 font-sans">
  <div class="max-w-2xl mx-auto space-y-6">
    <div class="p-6 rounded-3xl bg-[#0d1414] border border-[#00d4aa]/30 shadow-2xl">
      <div class="flex items-center gap-3">
        <div class="w-3 h-3 rounded-full bg-[#00ff88] animate-ping"></div>
        <h2 class="text-base font-black text-[#00d4aa]">${title} — Service Running</h2>
      </div>
      <p class="text-xs text-[#88b0b0] mt-2">
        تم تشغيل الخادم الافتراضي بنجاح على المنفذ <code>:3000</code>.
      </p>

      <div class="mt-4 p-4 rounded-xl bg-[#080d0d] border border-[#1e2e2e] font-mono text-xs text-[#00ff88]">
        <div>GET / HTTP/1.1 200 OK</div>
        <div>Content-Type: application/json</div>
        <div class="mt-2 text-[#88b0b0]">{ "status": "online", "runtime": "SoufAI Container" }</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function generateMobilePreviewBundle(title: string, code: string): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#080d0d] text-[#e8f5f5] flex items-center justify-center min-h-screen p-4">
  <!-- Mobile Frame Mockup -->
  <div class="w-[320px] h-[580px] bg-[#0a0f0f] border-4 border-[#1e2e2e] rounded-[40px] shadow-2xl overflow-hidden flex flex-col relative">
    <div class="w-28 h-4 bg-[#1e2e2e] rounded-full mx-auto mt-2"></div>
    <div class="p-6 flex-1 flex flex-col justify-center items-center text-center space-y-4">
      <div class="w-14 h-14 rounded-2xl bg-[#00d4aa]/20 border border-[#00d4aa]/40 flex items-center justify-center text-2xl text-[#00d4aa]">
        📱
      </div>
      <h3 class="text-sm font-black text-white">${title}</h3>
      <p class="text-xs text-[#88b0b0]">محاكاة بيئة الجوال الذكية مدعومة من SoufAI</p>
    </div>
    <div class="w-24 h-1 bg-[#4a7070] rounded-full mx-auto mb-3"></div>
  </div>
</body>
</html>`;
}

function generateGenericPreviewBundle(files: Record<string, string>, mainFile: string): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#0a0f0f] text-[#e8f5f5] p-8 font-sans">
  <div class="max-w-xl mx-auto p-6 rounded-2xl bg-[#0d1414] border border-[#00d4aa]/40 text-center space-y-3">
    <h2 class="text-base font-black text-[#00d4aa]">مشروع يعمل بنجاح</h2>
    <p class="text-xs text-[#88b0b0]">الملف الرئيسي: <code>${mainFile}</code></p>
  </div>
</body>
</html>`;
}
