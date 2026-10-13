"""Telegram bot glue — /start + Web App menu button. Env: BOT_TOKEN, WEBAPP_URL."""

import os

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, MenuButtonWebApp, Update, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
WEBAPP_URL = os.environ.get("WEBAPP_URL", "")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    keyboard = [[InlineKeyboardButton("🐱 Open Meow Translator", web_app=WebAppInfo(url=WEBAPP_URL))]] if WEBAPP_URL else []
    await update.message.reply_text(
        "Meow! Tap below to translate your cat. 🐾",
        reply_markup=InlineKeyboardMarkup(keyboard) if keyboard else None,
    )


async def post_init(app: Application) -> None:
    if WEBAPP_URL:
        await app.bot.set_chat_menu_button(menu_button=MenuButtonWebApp(text="Translate", web_app=WebAppInfo(url=WEBAPP_URL)))


def main() -> None:
    if not BOT_TOKEN:
        raise SystemExit("Set BOT_TOKEN env var first.")
    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()
    app.add_handler(CommandHandler("start", start))
    app.run_polling()


if __name__ == "__main__":
    main()
