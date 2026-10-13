import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "update_free_gardens", Path(__file__).with_name("update-free-gardens.py")
)
ufg = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ufg)

COLUMNS = ["Nr.", "Parzelle", "Größe", "frei ab", "Wertermittlung", "Wertminderung"]
STATE = {"changedAt": "2026-10-11", "columns": COLUMNS, "rows": [["156", "X", "360", "sofort", "", ""]]}


class AppendHistoryTest(unittest.TestCase):
    def setUp(self):
        self.path = Path(tempfile.mkdtemp()) / "verlauf.json"

    def snapshots(self):
        return json.loads(self.path.read_text(encoding="utf-8"))["snapshots"]

    def test_appends_only_changed_states(self):
        self.assertTrue(ufg.append_history(self.path, STATE))
        self.assertFalse(ufg.append_history(self.path, STATE))
        changed = {**STATE, "changedAt": "2026-10-20", "rows": []}
        self.assertTrue(ufg.append_history(self.path, changed))
        self.assertEqual([s["date"] for s in self.snapshots()], ["2026-10-11", "2026-10-20"])

    def test_never_overwrites_unreadable_history(self):
        self.path.write_text("{kaputt", encoding="utf-8")
        with self.assertRaises(ValueError):
            ufg.append_history(self.path, STATE)
        self.assertEqual(self.path.read_text(encoding="utf-8"), "{kaputt")


if __name__ == "__main__":
    unittest.main()
