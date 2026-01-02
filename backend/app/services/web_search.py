"""
Web search service using DuckDuckGo for the chat assistant.
"""

import httpx
import logging
from typing import List, Optional
from pydantic import BaseModel
import re
from html import unescape

logger = logging.getLogger(__name__)


class SearchResult(BaseModel):
    """A single search result."""
    title: str
    url: str
    snippet: str


class WebSearchService:
    """Service for web searches using DuckDuckGo HTML interface."""

    def __init__(self):
        self.base_url = "https://html.duckduckgo.com/html/"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

    async def search(self, query: str, max_results: int = 5) -> List[SearchResult]:
        """
        Perform a web search and return results.

        Args:
            query: The search query
            max_results: Maximum number of results to return

        Returns:
            List of SearchResult objects
        """
        results = []

        try:
            logger.info(f"Web search starting for: {query[:50]}...")

            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                response = await client.post(
                    self.base_url,
                    data={"q": query, "b": ""},
                    headers=self.headers,
                )

                logger.info(f"DuckDuckGo response status: {response.status_code}")

                if response.status_code != 200:
                    logger.warning(f"DuckDuckGo returned status {response.status_code}")
                    return results

                html = response.text

                # Multiple patterns to try for parsing DuckDuckGo results
                # Pattern 1: Standard result links
                pattern1 = r'<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>(.+?)</a>'
                # Pattern 2: Result snippets
                pattern2 = r'<a class="result__snippet"[^>]*>(.+?)</a>'

                links = re.findall(pattern1, html, re.DOTALL)
                snippets = re.findall(pattern2, html, re.DOTALL)

                logger.info(f"Found {len(links)} links and {len(snippets)} snippets")

                for i, (url, title) in enumerate(links[:max_results]):
                    # Clean up title
                    clean_title = re.sub(r'<[^>]+>', '', title)
                    clean_title = unescape(clean_title).strip()

                    # Get corresponding snippet if available
                    snippet = ""
                    if i < len(snippets):
                        snippet = re.sub(r'<[^>]+>', '', snippets[i])
                        snippet = unescape(snippet).strip()[:300]

                    # Skip empty results
                    if not clean_title or not url.strip():
                        continue

                    # Clean URL (remove tracking params)
                    clean_url = url.strip()
                    if clean_url.startswith("//duckduckgo.com/l/?uddg="):
                        # Extract actual URL from DDG redirect
                        import urllib.parse
                        try:
                            parsed = urllib.parse.parse_qs(urllib.parse.urlparse(clean_url).query)
                            if 'uddg' in parsed:
                                clean_url = urllib.parse.unquote(parsed['uddg'][0])
                        except:
                            pass

                    results.append(SearchResult(
                        title=clean_title,
                        url=clean_url,
                        snippet=snippet or "Pas de description disponible"
                    ))

                logger.info(f"Web search completed with {len(results)} results")

        except httpx.TimeoutException:
            logger.warning(f"Web search timeout for query: {query[:50]}")
        except Exception as e:
            logger.error(f"Web search error: {e}")

        return results

    def format_results_for_context(self, results: List[SearchResult], query: str) -> str:
        """
        Format search results as context for the LLM.

        Args:
            results: List of search results
            query: Original search query

        Returns:
            Formatted string to include in LLM context
        """
        if not results:
            return f"Recherche web pour '{query}': Aucun résultat trouvé."

        formatted = f"Résultats de recherche web pour '{query}':\n\n"

        for i, result in enumerate(results, 1):
            formatted += f"{i}. **{result.title}**\n"
            formatted += f"   URL: {result.url}\n"
            formatted += f"   {result.snippet}\n\n"

        formatted += "Utilise ces informations pour répondre à la question de l'utilisateur de manière informée et précise."

        return formatted


# Singleton instance
_web_search_service: Optional[WebSearchService] = None


def get_web_search_service() -> WebSearchService:
    """Get or create the web search service singleton."""
    global _web_search_service
    if _web_search_service is None:
        _web_search_service = WebSearchService()
    return _web_search_service
