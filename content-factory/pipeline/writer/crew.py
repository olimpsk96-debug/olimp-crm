"""
CrewAI команда контент-завода ОЛИМП.

6 агентов в последовательности:
    researcher -> outliner -> writer -> fact_checker -> seo_aeo_optimizer -> editor

Запуск:
    from pipeline.writer.crew import build_crew
    crew = build_crew()
    result = crew.kickoff(inputs={"topic_title": "Герметизация межпанельных швов"})
"""
from __future__ import annotations

import yaml
from pathlib import Path
from typing import Any

from crewai import Agent, Crew, Process, Task
from crewai.llm import LLM

from pipeline.settings import PROMPTS_DIR, CONFIG_DIR, settings


def _load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")


def _load_yaml(name: str) -> dict[str, Any]:
    return yaml.safe_load((CONFIG_DIR / f"{name}.yml").read_text(encoding="utf-8"))


def _brand_context() -> str:
    """Краткая выжимка из brand_voice.yml для system-context каждого агента."""
    bv = _load_yaml("brand_voice")
    b = bv["brand"]
    return (
        f"Компания: {b['name']} ({b['legal_name']}), {b['city']}, {b['region']}. "
        f"Сайт: {b['website']}. С {b['founded']} года, {b['experience_years']}+ лет на рынке, "
        f"{b['completed_projects']}+ объектов. Адрес: {b['address']}. "
        f"Телефон: {b['phones'][0]}. Telegram: {b['telegram_channel']}. "
        f"Специализация: {', '.join(b['specialization']['primary'])}. "
        f"Услуг на сайте: {b['specialization']['services_count']}. "
        f"Ключевые клиенты: {', '.join(b['key_clients'])}. "
        f"Директор: {b['director']['name']} ({b['director']['role']})."
    )


def _llm(model: str, temperature: float = 0.3) -> LLM:
    return LLM(
        model=f"anthropic/{model}",
        api_key=settings.anthropic_api_key,
        temperature=temperature,
        max_tokens=8192,
    )


def build_agents() -> dict[str, Agent]:
    brand = _brand_context()

    researcher = Agent(
        role="Старший исследователь технического B2B-контента",
        goal=(
            "Собрать полную фактуру по теме статьи: технологию, нормативку, цены ЕКБ 2026, "
            "SERP-анализ топ-10 Яндекса, AI-visibility данные, кейсы ОЛИМП из RAG."
        ),
        backstory=(
            f"{brand}\n\n"
            "Ты профессиональный исследователь, который собирает фактуру для статей. "
            "Твоя сильная сторона — глубокая работа с нормативкой (СП, ГОСТ, СНиП), "
            "анализ конкурентов из топ-10 Яндекса и привязка к локальному контексту Урала. "
            "Ты не пишешь сам статьи — твоя задача дать максимум проверенной фактуры."
        ),
        system_template=_load_prompt("researcher"),
        llm=_llm(settings.research_model, temperature=0.2),
        verbose=True,
        allow_delegation=False,
        max_iter=8,
    )

    outliner = Agent(
        role="Архитектор структуры B2B-статей",
        goal=(
            "Превратить research-данные в чёткий план статьи, "
            "оптимизированный одновременно под Яндекс SERP и AI-ответчики (Yandex Neuro, Perplexity, ChatGPT)."
        ),
        backstory=(
            f"{brand}\n\n"
            "Ты SEO-стратег и информационный архитектор. "
            "Знаешь принципы AEO/GEO 2026: answer-first lead, question-based H2, "
            "FAQ под Schema FAQPage, HowTo под Schema HowTo. "
            "Главный поисковик — Яндекс (76% РФ), поэтому учитываешь его особенности."
        ),
        system_template=_load_prompt("outliner"),
        llm=_llm(settings.research_model, temperature=0.4),
        verbose=True,
        allow_delegation=False,
        max_iter=3,
    )

    writer = Agent(
        role="Старший копирайтер, инженер ПТО",
        goal=(
            "Написать экспертную B2B-статью 2500-4000 слов от лица инженера ПТО ОЛИМП "
            "по готовому outline и research-данным."
        ),
        backstory=(
            f"{brand}\n\n"
            "Ты пишешь от первого лица инженера ПТО ОЛИМП. Опыт промальпа 17+ лет. "
            "Стиль — экспертно-технический B2B без воды и маркетинговых клише. "
            "Каждое утверждение — с цифрами или нормативкой. "
            "Кейсы — с именами клиентов (ЕВРАЗ, РУСАЛ, БЦ Президент). "
            "Гео-сигналы — Екатеринбург, Урал, при -30°C."
        ),
        system_template=_load_prompt("writer"),
        llm=_llm(settings.writer_model, temperature=0.6),
        verbose=True,
        allow_delegation=False,
        max_iter=2,
    )

    fact_checker = Agent(
        role="Технический рецензент",
        goal=(
            "Проверить статью на фактические ошибки: hallucinated цифры, "
            "неверные нормативные ссылки, выдуманные кейсы, неточности по охране труда."
        ),
        backstory=(
            f"{brand}\n\n"
            "Ты технический рецензент-параноик. Если цифра не подтверждается RAG/research — режешь. "
            "Если СП/ГОСТ процитирован неточно — режешь. "
            "Если кейс выдуманный — режешь. "
            "Твой verdict блокирует или пропускает публикацию."
        ),
        system_template=_load_prompt("fact_checker"),
        llm=_llm(settings.fact_check_model, temperature=0.0),
        verbose=True,
        allow_delegation=False,
        max_iter=3,
    )

    seo_aeo = Agent(
        role="SEO/AEO/GEO инженер",
        goal=(
            "Оптимизировать статью под Яндекс YATI + AI-ответчики 2026. "
            "Сгенерировать Schema.org JSON-LD, расставить internal links, "
            "подготовить meta-теги и image SEO."
        ),
        backstory=(
            f"{brand}\n\n"
            "Ты SEO-инженер, специализируешься на AEO/GEO 2026. "
            "Знаешь что Яндекс YATI ценит живой русский, а AI-ответчики любят "
            "answer-first структуру, question-based H2 и Schema.org разметку. "
            "Знаешь про AI Citation Decay 13 недель."
        ),
        system_template=_load_prompt("seo_aeo_optimizer"),
        llm=_llm(settings.research_model, temperature=0.3),
        verbose=True,
        allow_delegation=False,
        max_iter=3,
    )

    editor = Agent(
        role="Финальный редактор-полировщик",
        goal=(
            "Довести статью до публикуемого состояния: anti-AI-fingerprint, "
            "E-E-A-T усиление, читабельность, генерация socials-версий и video-script."
        ),
        backstory=(
            f"{brand}\n\n"
            "Ты последний редактор. Убираешь следы AI (ровный ритм, шаблонные обороты), "
            "усиливаешь голос инженера-эксперта, готовишь короткие версии для Telegram/Instagram/TikTok "
            "и пишешь сценарий для faceless-видео."
        ),
        system_template=_load_prompt("editor"),
        llm=_llm(settings.edit_model, temperature=0.5),
        verbose=True,
        allow_delegation=False,
        max_iter=2,
    )

    return {
        "researcher": researcher,
        "outliner": outliner,
        "writer": writer,
        "fact_checker": fact_checker,
        "seo_aeo": seo_aeo,
        "editor": editor,
    }


def build_tasks(agents: dict[str, Agent]) -> list[Task]:
    research_task = Task(
        description=(
            "Тема статьи: {topic_title}. "
            "Целевые ключи: {target_keywords}. "
            "Кластер: {cluster}. Формат: {format}. Тип страницы: {page_type}. "
            "Целевая аудитория: {audience}.\n\n"
            "Собери полную фактическую базу для написания статьи. "
            "Используй RAG (own_content, norms_sp, norms_gost, cases), "
            "SERP топ-10 Яндекса по теме, AI-visibility данные. "
            "Верни структурированный JSON по шаблону в твоём системном промпте."
        ),
        expected_output=(
            "JSON с полями: topic, main_keywords, audience, facts, norms, market, "
            "serp_analysis, ai_visibility, own_content_warnings, related_services, "
            "olimp_cases, sources."
        ),
        agent=agents["researcher"],
    )

    outline_task = Task(
        description=(
            "На основе research-данных составь outline статьи. "
            "Тема: {topic_title}. Целевая длина: {target_word_count} слов. "
            "Format: {format}. Учти принципы AEO/GEO 2026, гео-сигналы Екатеринбург/Урал. "
            "Если research нашёл каннибализацию — обойди её через discriminator."
        ),
        expected_output=(
            "JSON с полями: slug, h1, title, meta_description, intro_target, format, "
            "target_word_count, outline (массив H2 с key_points и internal_links), "
            "faq, schema_org, cta_block, warnings."
        ),
        agent=agents["outliner"],
        context=[research_task],
    )

    writing_task = Task(
        description=(
            "Напиши полную статью по outline. "
            "Тема: {topic_title}. Соблюдай tone of voice (см. brand_voice). "
            "Кейсы — из research, не выдумывай. Цифры — из research/RAG, не выдумывай. "
            "В тексте отмечай [IMG:], [TABLE:], [VIDEO:] маркеры."
        ),
        expected_output=(
            "Полный markdown статьи с frontmatter, H1, lead-абзацем, всеми H2/H3, "
            "FAQ-блоком, CTA-блоком, об-авторе блоком и маркерами медиа."
        ),
        agent=agents["writer"],
        context=[research_task, outline_task],
    )

    fact_check_task = Task(
        description=(
            "Проверь черновик на factual errors. "
            "Каждая цифра должна подтверждаться research/RAG. "
            "Каждая ссылка на СП/ГОСТ — проверена. "
            "Каждый кейс — реальный. "
            "Если verdict = rejected или needs_fixes — верни список issues с fix_suggestion. "
            "Если approved — пропусти дальше."
        ),
        expected_output=(
            "JSON с verdict, fact_check_score, issues[], verified_facts[], "
            "olimp_brand_consistency. Если есть critical issues — verdict=rejected."
        ),
        agent=agents["fact_checker"],
        context=[research_task, writing_task],
    )

    seo_aeo_task = Task(
        description=(
            "Оптимизируй статью под Яндекс YATI и AI-ответчики 2026. "
            "Применяй принципы AEO/GEO. Сгенерируй Schema.org JSON-LD "
            "(Article + FAQPage + при необходимости HowTo/Service). "
            "Расставь 3-7 internal links на связанные услуги. "
            "Подготовь meta-теги и image metadata."
        ),
        expected_output=(
            "JSON с полями optimized_text_md, seo_meta, schema_jsonld, "
            "internal_links_added, image_metadata, llms_txt_line, yandex_specific."
        ),
        agent=agents["seo_aeo"],
        context=[outline_task, writing_task, fact_check_task],
    )

    edit_task = Task(
        description=(
            "Финальная полировка: anti-AI-fingerprint, E-E-A-T усиление, читабельность. "
            "Дополнительно сгенерируй короткие версии для Telegram (800-1500 знаков), "
            "Instagram caption (1500-2200), Instagram Reel caption (300-500), "
            "TikTok caption (150-300). "
            "Если outline указал video=true — напиши video script для reelsmaker."
        ),
        expected_output=(
            "YAML с полями final_article (body_md, body_html, preview_text), "
            "socials (telegram_md, instagram_caption, instagram_reel_caption, tiktok_caption), "
            "video_script (scenes, total_duration_sec, tts_text), "
            "publishing_metadata (ready_to_publish, reviewer_notes)."
        ),
        agent=agents["editor"],
        context=[seo_aeo_task],
    )

    return [research_task, outline_task, writing_task, fact_check_task, seo_aeo_task, edit_task]


def build_crew() -> Crew:
    agents = build_agents()
    tasks = build_tasks(agents)
    return Crew(
        agents=list(agents.values()),
        tasks=tasks,
        process=Process.sequential,
        verbose=True,
        memory=False,  # включим после первых прогонов
    )


if __name__ == "__main__":
    # Минимальный smoke-test (требует валидный ANTHROPIC_API_KEY и подключённые RAG-tools)
    crew = build_crew()
    inputs = {
        "topic_title": "Герметизация межпанельных швов: технология, материалы, цены 2026",
        "target_keywords": ["герметизация межпанельных швов екатеринбург", "тёплый шов цена"],
        "cluster": "germetizaciya",
        "format": "pillar",
        "page_type": "service",
        "audience": "primary",
        "target_word_count": 3000,
    }
    result = crew.kickoff(inputs=inputs)
    print(result)
