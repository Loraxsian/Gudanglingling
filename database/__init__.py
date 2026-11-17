"""
Database package initialization.
"""
from database.db import (
    init_db,
    get_all_items,
    get_item_by_id,
    update_item_status,
    save_borrowing_record,
    complete_return_check,
    get_borrowing_record_by_id,
    get_reminder_queue,
    get_borrowing_history,
    log_email_archive,
    get_email_logs,
    unlock_maintenance_item
)

__all__ = [
    "init_db",
    "get_all_items",
    "get_item_by_id",
    "update_item_status",
    "save_borrowing_record",
    "complete_return_check",
    "get_borrowing_record_by_id",
    "get_reminder_queue",
    "get_borrowing_history",
    "log_email_archive",
    "get_email_logs",
    "unlock_maintenance_item"
]
