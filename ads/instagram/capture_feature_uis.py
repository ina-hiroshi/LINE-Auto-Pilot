#!/usr/bin/env python3
"""Capture real IToguchi UI sections from public feature pages."""

from __future__ import annotations

from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path("/Users/inahiroshi/開発/LINE-Auto-Pilot/ads/instagram/ui-shots")
OUT.mkdir(parents=True, exist_ok=True)


def shot_section(page, heading: str, filename: str, pad: int = 24) -> None:
    loc = page.locator("h2", has_text=heading).first
    loc.wait_for(timeout=30000)
    section = loc.locator("xpath=ancestor::section[1]")
    section.scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    path = OUT / filename
    section.screenshot(path=str(path), type="png")
    print("wrote", path)


def shot_card_near(page, heading: str, filename: str) -> None:
    loc = page.locator("h3,h2,h4", has_text=heading).first
    loc.wait_for(timeout=30000)
    # Prefer nearest white card / rounded container
    card = loc.locator(
        "xpath=ancestor::div[contains(@class,'rounded') or contains(@class,'shadow') or contains(@class,'bg-white')][1]"
    )
    card.scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    path = OUT / filename
    card.screenshot(path=str(path), type="png")
    print("wrote", path)


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900}, device_scale_factor=2)

        # AI feature: admin UI + analysis report demo
        page.goto("https://itoguchi-app.jp/feature/ai", wait_until="networkidle")
        shot_section(page, "実際の管理画面", "ui-ai-admin.png")
        shot_card_near(page, "AIによるデータ分析", "ui-ai-report.png")

        # Auto response
        page.goto("https://itoguchi-app.jp/feature/auto-response", wait_until="networkidle")
        shot_section(page, "実際の管理画面", "ui-autoresponse.png")

        # Reservation
        page.goto("https://itoguchi-app.jp/feature/reservation", wait_until="networkidle")
        shot_section(page, "実際の管理画面", "ui-reservation.png")

        # Membership
        page.goto("https://itoguchi-app.jp/feature/membership", wait_until="networkidle")
        shot_section(page, "実際の管理画面", "ui-membership.png")

        browser.close()


if __name__ == "__main__":
    main()
