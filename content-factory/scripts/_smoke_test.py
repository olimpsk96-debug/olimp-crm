"""Минимальный smoke-test что settings + configs корректны."""
import sys
from pipeline.settings import settings, CONFIG_DIR, ARTICLES_DIR
import yaml


def main() -> int:
    print("=== SETTINGS ===")
    print(f"  wp_url: {settings.wp_url}")
    print(f"  draft_mode: {settings.draft_mode}")
    print(f"  anthropic_set: {bool(settings.anthropic_api_key)}")
    print(f"  tg_bot_set: {bool(settings.tg_bot_token)}")
    print(f"  tg_review_chat: {settings.tg_chat_for_review}")
    print(f"  qdrant: {settings.qdrant_url}")
    print(f"  minio: {settings.minio_endpoint}")
    print(f"  articles_dir: {ARTICLES_DIR}")

    print("\n=== TOPICS ===")
    topics = yaml.safe_load((CONFIG_DIR / "topics.yml").read_text(encoding="utf-8"))
    total_topics = 0
    for cluster_key, cluster in topics["topics"].items():
        n = len(cluster["items"])
        total_topics += n
        prio = cluster.get("priority", "?")
        print(f"  [{prio}] {cluster_key}: {n} items")
    print(f"  TOTAL TOPICS: {total_topics}")

    print("\n=== KEYWORDS ===")
    kw = yaml.safe_load((CONFIG_DIR / "keywords.yml").read_text(encoding="utf-8"))
    total_kw = 0
    for c_key, c in kw["clusters"].items():
        n = len(c["keywords"])
        total_kw += n
        print(f"  [{c.get('priority', '?')}] {c_key}: {n}")
    print(f"  TOTAL KEYWORDS: {total_kw}")

    print("\n=== BRAND ===")
    bv = yaml.safe_load((CONFIG_DIR / "brand_voice.yml").read_text(encoding="utf-8"))
    b = bv["brand"]
    print(f"  name: {b['name']}")
    print(f"  website: {b['website']}")
    print(f"  founded: {b['founded']}")
    print(f"  services: {b['specialization']['services_count']}")
    print(f"  clients: {', '.join(b['key_clients'][:3])}…")

    print("\n=== prompts/ ===")
    from pipeline.settings import PROMPTS_DIR
    for f in sorted(PROMPTS_DIR.glob("*.md")):
        size = f.stat().st_size
        print(f"  {f.name}: {size:>5d} bytes")

    # Тест что generate_article._load_topic корректно резолвит topic-id
    print("\n=== TOPIC LOADER ===")
    sys.path.insert(0, ".")
    from orchestrator.generate_article import _load_topic, _slugify

    inputs = _load_topic("comm_01", None)
    print(f"  topic-id 'comm_01' resolved:")
    print(f"    title: {inputs['topic_title']}")
    print(f"    target_keywords: {inputs['target_keywords']}")
    print(f"    target_word_count: {inputs['target_word_count']}")
    print(f"    cluster: {inputs['cluster']}")
    print(f"    slug: {_slugify(inputs['topic_title'])}")

    print("\nSMOKE OK ✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
