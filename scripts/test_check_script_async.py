import os
import tempfile
import unittest

import check_script_async as c


class T(unittest.TestCase):
    def scan(self, html):
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, "a.html"), "w") as f:
                f.write(html)
            return c.scan(d)

    def test_flags_blocking_outside(self):
        self.assertEqual(len(self.scan('<script src="https://x.com/a.js"></script>')), 1)
        self.assertEqual(len(self.scan('<script\n src="//x.com/a.js"></script>')), 1)

    def test_ok_cases(self):
        for h in ('<script async src="https://x.com/a.js"></script>',
                  '<script src="https://x.com/a.js" defer></script>',
                  '<script src="/local.js"></script>',
                  '<script>var a=1</script>'):
            self.assertEqual(self.scan(h), [], h)

    def test_repo_clean(self):
        root = os.path.join(os.path.dirname(__file__), "..")
        self.assertEqual(c.scan(root), [])


if __name__ == "__main__":
    unittest.main()
