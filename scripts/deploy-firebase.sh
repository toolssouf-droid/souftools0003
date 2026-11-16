#!/usr/bin/env bash
# ==============================================================================
# سكربت فحص ونشر منصة SoufTools على Firebase Hosting
# SoufTools AI - Firebase Deployment Assistant
# ==============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}      🚀 تهيئة ونشر منصة SoufTools على Firebase        ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. التحقق من وجود Firebase CLI
echo -e "\n${YELLOW}[1/4] فحص أداة Firebase CLI...${NC}"
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ أداة firebase-tools غير مثبتة.${NC}"
    echo -e "لتثبيتها، شغّل الأمر:"
    echo -e "  npm install -g firebase-tools"
    exit 1
else
    echo -e "${GREEN}✓ Firebase CLI متوفر الإصدار: $(firebase --version)${NC}"
fi

# 2. التحقق من تسجيل الدخول
echo -e "\n${YELLOW}[2/4] فحص حالة تسجيل الدخول في Firebase...${NC}"
if ! firebase login:list 2>/dev/null | grep -q "@"; then
    echo -e "${YELLOW}⚠️ لم تقم بتسجيل الدخول بعد. سيتم فتح نافذة المصادقة...${NC}"
    firebase login
else
    echo -e "${GREEN}✓ أنت مسجل الدخول بالفعل.${NC}"
fi

# 3. تفعيل دعم أطر عمل الويب (Next.js SSR)
echo -e "\n${YELLOW}[3/4] تفعيل تجربة Web Frameworks في Firebase...${NC}"
firebase experiments:enable webframeworks

# 4. النشر الفعلي
echo -e "\n${YELLOW}[4/4] بدء النشر على مشروع souftoolsheb-92e1c...${NC}"
echo -e "${BLUE}جاري بناء ونشر الاستضافة وقواعد الأمان...${NC}"

firebase deploy --project souftoolsheb-92e1c

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}  🎉 تم نشر منصة SoufTools على Firebase بنجاح!        ${NC}"
echo -e "${GREEN}  رابط الاستضافة الافتراضي:                            ${NC}"
echo -e "${GREEN}  https://souftoolsheb-92e1c.web.app                   ${NC}"
echo -e "${GREEN}  https://souftoolsheb-92e1c.firebaseapp.com           ${NC}"
echo -e "${GREEN}======================================================${NC}"
