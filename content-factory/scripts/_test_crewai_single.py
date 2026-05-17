"""
Простейший CrewAI-test с одним агентом (writer).
Без research/RAG/fact-check — просто проверка что Claude отвечает через crewai.

Цель: получить короткий черновик статьи (~500 слов) на тестовую тему.
"""
import sys
from pathlib import Path

from crewai import Agent, Crew, Process, Task
from crewai.llm import LLM
from loguru import logger

from pipeline.settings import settings, PROMPTS_DIR


def main() -> int:
    if not settings.anthropic_api_key:
        logger.error("ANTHROPIC_API_KEY не настроен")
        return 1

    writer_prompt = (PROMPTS_DIR / "writer.md").read_text(encoding="utf-8")

    llm = LLM(
        model="anthropic/claude-sonnet-4-6",  # sonnet для теста — экономнее opus
        api_key=settings.anthropic_api_key,
        temperature=0.5,
        max_tokens=4096,
    )

    writer = Agent(
        role="Старший копирайтер, инженер ПТО ОЛИМП",
        goal=(
            "Написать КОРОТКИЙ тестовый черновик статьи (700-1000 слов) "
            "по теме ниже. Это smoke-test, поэтому не требуется глубокий research — "
            "опирайся на общие знания о промышленном альпинизме."
        ),
        backstory=(
            "Ты пишешь от лица инженера ПТО компании ОЛИМП (Екатеринбург, "
            "с 2007 года, 200+ объектов, услуги: промальп, герметизация, фасады, "
            "кровля, АКЗ металлоконструкций). Стиль — экспертный B2B без воды. "
            "Клиенты: ЕВРАЗ, РУСАЛ, Атомстройкомплекс, БЦ Президент."
        ),
        system_template=writer_prompt,
        llm=llm,
        verbose=True,
        allow_delegation=False,
        max_iter=1,
    )

    task = Task(
        description=(
            "Тема: «{topic_title}»\n"
            "Целевые ключи: {target_keywords}\n"
            "Длина: 700-1000 слов (это smoke-test)\n"
            "Аудитория: главные инженеры УК / собственники зданий в Екатеринбурге\n\n"
            "Требования:\n"
            "1. Lead-абзац 60-100 слов с прямым ответом на главный вопрос темы "
            "и упоминанием Екатеринбурга — это extract для AI-ответчиков.\n"
            "2. 3-4 раздела H2.\n"
            "3. FAQ из 3 пар вопрос-ответ.\n"
            "4. CTA-блок с телефоном +7 (343) 351-05-59 и каналом @promalp_ural.\n"
            "5. Подпись автора в конце.\n"
            "6. Маркеры [IMG: ...] и [TABLE: ...] в нужных местах.\n\n"
            "Не используй маркетинговые клише. Только конкретика и цифры."
        ),
        expected_output=(
            "Полный markdown статьи 700-1000 слов с frontmatter, H1, "
            "lead-абзацем, разделами H2, FAQ-блоком, CTA-блоком и подписью автора."
        ),
        agent=writer,
    )

    crew = Crew(
        agents=[writer],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )

    inputs = {
        "topic_title": "Уборка снега и сосулек с крыши в Екатеринбурге: когда вызывать альпинистов",
        "target_keywords": "уборка снега с крыши екатеринбург, сбить сосульки",
    }

    logger.info(f"Kickoff with inputs: {inputs}")
    result = crew.kickoff(inputs=inputs)

    # Сохранить результат
    out_dir = Path("/app/storage/test_runs")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "_test_crewai_single.md"
    out_file.write_text(str(result.raw if hasattr(result, "raw") else result), encoding="utf-8")
    logger.success(f"✓ Result saved to {out_file}")
    logger.info(f"Token usage (если доступно): {getattr(result, 'token_usage', 'n/a')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
