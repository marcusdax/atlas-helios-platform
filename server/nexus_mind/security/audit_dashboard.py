"""
Nexus Mind Security - Audit Dashboard

Streamlit-based dashboard for visualizing IronClaw audit logs,
leak detection events, and security metrics.
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass

logger = logging.getLogger(__name__)

try:
    import streamlit as st
    import pandas as pd

    DASHBOARD_AVAILABLE = True
except ImportError:
    DASHBOARD_AVAILABLE = False
    logger.warning("Streamlit not available, dashboard will use fallback")


@dataclass
class DashboardConfig:
    """Configuration for the audit dashboard."""

    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "ironclaw_secure"
    db_user: str = "ironclaw"
    refresh_interval: int = 30
    max_display_rows: int = 1000


class AuditDashboard:
    """
    Streamlit-based audit dashboard for IronClaw.

    Provides:
    - Real-time execution monitoring
    - Leak detection alerts
    - Performance metrics
    - Compliance reporting
    """

    def __init__(self, config: Optional[DashboardConfig] = None):
        self.config = config or DashboardConfig()
        self._init_connection()

    def _init_connection(self):
        """Initialize database connection."""
        self._conn = None

        if DASHBOARD_AVAILABLE:
            try:
                import psycopg2

                self._conn = psycopg2.connect(
                    host=self.config.db_host,
                    port=self.config.db_port,
                    dbname=self.config.db_name,
                    user=self.config.db_user,
                    password=os.environ.get("IRONCLAW_DB_PASSWORD"),
                )
            except Exception as e:
                logger.warning(f"Database connection failed: {e}")

    def run(self):
        """Run the Streamlit dashboard."""
        if not DASHBOARD_AVAILABLE:
            self._run_fallback()
            return

        st.set_page_config(
            page_title="Nexus Mind Security Dashboard",
            page_icon="🛡️",
            layout="wide",
        )

        st.title("🛡️ Nexus Mind Security Dashboard")

        st.sidebar.header("Configuration")
        st.sidebar.text(f"Database: {self.config.db_host}:{self.config.db_port}")
        st.sidebar.text(f"Refresh: {self.config.refresh_interval}s")

        time_range = st.sidebar.selectbox(
            "Time Range",
            ["Last Hour", "Last 24 Hours", "Last 7 Days", "Last 30 Days", "All Time"],
        )

        start_date, end_date = self._get_time_range(time_range)

        self._render_metrics(start_date, end_date)

        col1, col2 = st.columns(2)

        with col1:
            self._render_execution_chart(start_date, end_date)

        with col2:
            self._render_tool_distribution(start_date, end_date)

        self._render_executions_table(start_date, end_date)
        self._render_leak_events(start_date, end_date)

    def _render_metrics(self, start_date: datetime, end_date: datetime):
        """Render summary metrics."""
        col1, col2, col3, col4 = st.columns(4)

        with col1:
            total = self._get_total_executions(start_date, end_date)
            st.metric("Total Executions", f"{total:,}")

        with col2:
            success_rate = self._get_success_rate(start_date, end_date)
            st.metric("Success Rate", f"{success_rate:.1f}%")

        with col3:
            leaks = self._get_leak_count(start_date, end_date)
            st.metric("Leak Events", f"{leaks}")

        with col4:
            avg_latency = self._get_avg_latency(start_date, end_date)
            st.metric("Avg Latency", f"{avg_latency:.1f}ms")

    def _render_execution_chart(self, start_date: datetime, end_date: datetime):
        """Render execution timeline chart."""
        st.subheader("Executions Over Time")

        data = self._get_execution_timeline(start_date, end_date)

        if DASHBOARD_AVAILABLE and data:
            df = pd.DataFrame(data)
            st.line_chart(df.set_index("timestamp"))
        else:
            st.info("No execution data available")

    def _render_tool_distribution(self, start_date: datetime, end_date: datetime):
        """Render tool distribution pie chart."""
        st.subheader("Tool Distribution")

        data = self._get_tool_distribution(start_date, end_date)

        if DASHBOARD_AVAILABLE and data:
            df = pd.DataFrame(data)
            st.bar_chart(df.set_index("tool_name"))
        else:
            st.info("No tool data available")

    def _render_executions_table(self, start_date: datetime, end_date: datetime):
        """Render executions table."""
        st.subheader("Recent Executions")

        data = self._get_executions(start_date, end_date)

        if DASHBOARD_AVAILABLE and data:
            df = pd.DataFrame(data)
            st.dataframe(
                df,
                use_container_width=True,
                height=300,
            )
        else:
            st.info("No execution data available")

    def _render_leak_events(self, start_date: datetime, end_date: datetime):
        """Render leak detection events."""
        st.subheader("🚨 Leak Detection Events")

        data = self._get_leak_events(start_date, end_date)

        if DASHBOARD_AVAILABLE and data:
            df = pd.DataFrame(data)

            st.dataframe(
                df.style.apply(
                    lambda x: [
                        "background-color: #ffcccc"
                        if x.get("severity") == "high"
                        else ""
                        for i in x
                    ],
                    axis=1,
                ),
                use_container_width=True,
                height=200,
            )
        else:
            st.success("No leak events detected!")

    def _get_time_range(self, selection: str) -> tuple:
        """Get start and end dates from selection."""
        now = datetime.now(timezone.utc)

        if selection == "Last Hour":
            return now - timedelta(hours=1), now
        elif selection == "Last 24 Hours":
            return now - timedelta(days=1), now
        elif selection == "Last 7 Days":
            return now - timedelta(days=7), now
        elif selection == "Last 30 Days":
            return now - timedelta(days=30), now
        else:
            return datetime(2000, 1, 1), now

    def _get_total_executions(self, start: datetime, end: datetime) -> int:
        """Get total execution count."""
        if not self._conn:
            return 0

        try:
            import psycopg2

            with self._conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM tool_executions WHERE start_time BETWEEN %s AND %s",
                    (start, end),
                )
                return cur.fetchone()[0] or 0
        except:
            return 0

    def _get_success_rate(self, start: datetime, end: datetime) -> float:
        """Get success rate percentage."""
        if not self._conn:
            return 0.0

        try:
            with self._conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM tool_executions WHERE start_time BETWEEN %s AND %s AND status = 'success'",
                    (start, end),
                )
                success = cur.fetchone()[0] or 0

                cur.execute(
                    "SELECT COUNT(*) FROM tool_executions WHERE start_time BETWEEN %s AND %s",
                    (start, end),
                )
                total = cur.fetchone()[0] or 1

                return (success / total) * 100
        except:
            return 0.0

    def _get_leak_count(self, start: datetime, end: datetime) -> int:
        """Get leak event count."""
        if not self._conn:
            return 0

        try:
            with self._conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM leak_events WHERE detected_at BETWEEN %s AND %s",
                    (start, end),
                )
                return cur.fetchone()[0] or 0
        except:
            return 0

    def _get_avg_latency(self, start: datetime, end: datetime) -> float:
        """Get average execution latency."""
        if not self._conn:
            return 0.0

        try:
            with self._conn.cursor() as cur:
                cur.execute(
                    "SELECT AVG(execution_time_ms) FROM tool_executions WHERE start_time BETWEEN %s AND %s AND execution_time_ms IS NOT NULL",
                    (start, end),
                )
                result = cur.fetchone()[0]
                return float(result) if result else 0.0
        except:
            return 0.0

    def _get_execution_timeline(self, start: datetime, end: datetime) -> List[Dict]:
        """Get execution timeline data."""
        if not self._conn:
            return []

        try:
            with self._conn.cursor() as cur:
                cur.execute(
                    """SELECT DATE_TRUNC('hour', start_time) as hour, COUNT(*) as count
                       FROM tool_executions 
                       WHERE start_time BETWEEN %s AND %s
                       GROUP BY hour
                       ORDER BY hour""",
                    (start, end),
                )
                return [{"timestamp": r[0], "count": r[1]} for r in cur.fetchall()]
        except:
            return []

    def _get_tool_distribution(self, start: datetime, end: datetime) -> List[Dict]:
        """Get tool usage distribution."""
        if not self._conn:
            return []

        try:
            with self._conn.cursor() as cur:
                cur.execute(
                    """SELECT tool_name, COUNT(*) as count
                       FROM tool_executions 
                       WHERE start_time BETWEEN %s AND %s
                       GROUP BY tool_name
                       ORDER BY count DESC
                       LIMIT 10""",
                    (start, end),
                )
                return [{"tool_name": r[0], "count": r[1]} for r in cur.fetchall()]
        except:
            return []

    def _get_executions(self, start: datetime, end: datetime) -> List[Dict]:
        """Get recent executions."""
        if not self._conn:
            return []

        try:
            with self._conn.cursor() as cur:
                cur.execute(
                    """SELECT execution_id, tool_name, status, execution_time_ms, start_time
                       FROM tool_executions 
                       WHERE start_time BETWEEN %s AND %s
                       ORDER BY start_time DESC
                       LIMIT %s""",
                    (start, end, self.config.max_display_rows),
                )
                return [
                    {
                        "execution_id": r[0][:16] + "...",
                        "tool_name": r[1],
                        "status": r[2],
                        "latency_ms": round(r[3], 2) if r[3] else 0,
                        "timestamp": r[4].isoformat() if r[4] else "",
                    }
                    for r in cur.fetchall()
                ]
        except:
            return []

    def _get_leak_events(self, start: datetime, end: datetime) -> List[Dict]:
        """Get leak detection events."""
        if not self._conn:
            return []

        try:
            with self._conn.cursor() as cur:
                cur.execute(
                    """SELECT job_id, tool_name, details, detected_at
                       FROM leak_events 
                       WHERE detected_at BETWEEN %s AND %s
                       ORDER BY detected_at DESC
                       LIMIT 50""",
                    (start, end),
                )
                return [
                    {
                        "job_id": r[0][:16] + "...",
                        "tool_name": r[1],
                        "details": r[2][:100] + "..."
                        if r[2] and len(r[2]) > 100
                        else r[2],
                        "severity": "high"
                        if "credential" in (r[2] or "").lower()
                        else "medium",
                        "timestamp": r[3].isoformat() if r[3] else "",
                    }
                    for r in cur.fetchall()
                ]
        except:
            return []

    def _run_fallback(self):
        """Run fallback CLI dashboard."""
        print("=" * 60)
        print("Nexus Mind Security Dashboard (CLI Mode)")
        print("=" * 60)
        print("\nNote: Install streamlit for full dashboard")
        print("  pip install streamlit pandas psycopg2-binary")
        print("\nRun with: streamlit run nexus_mind/security/audit_dashboard.py")


def run_dashboard():
    """Entry point for running the dashboard."""
    dashboard = AuditDashboard()
    dashboard.run()


if __name__ == "__main__":
    if DASHBOARD_AVAILABLE:
        run_dashboard()
    else:
        dashboard = AuditDashboard()
        dashboard._run_fallback()


__all__ = [
    "AuditDashboard",
    "DashboardConfig",
    "run_dashboard",
]
