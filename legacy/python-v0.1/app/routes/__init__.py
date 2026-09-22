"""ثبت همه مسیرهای API برنامه."""
from __future__ import annotations

from . import (api_analytics, api_exams, api_questions, api_readiness, api_resources,
               api_review, api_system, api_teaching, api_topics)


def register_all() -> None:
    for module in (api_resources, api_topics, api_questions, api_review, api_teaching,
                   api_exams, api_readiness, api_analytics, api_system):
        module.register()
