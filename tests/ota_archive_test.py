import importlib.util, pathlib, sys, tarfile, unittest
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('safe_extract',pathlib.Path(__file__).parents[1]/'deploy/ota/safe-extract.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class ArchiveTests(unittest.TestCase):
    def member(self,name,kind=tarfile.REGTYPE,size=1):
        value=tarfile.TarInfo(name);value.type=kind;value.size=size;return value
    def test_valid(self):module.validate([self.member('release-manifest.json'),self.member('server/index.js')])
    def test_unsafe(self):
        for name,kind in [('../x',tarfile.REGTYPE),('/etc/passwd',tarfile.REGTYPE),('server/link',tarfile.SYMTYPE),('server/fifo',tarfile.FIFOTYPE),('.env',tarfile.REGTYPE)]:
            with self.subTest(name=name),self.assertRaises(ValueError):module.validate([self.member('release-manifest.json'),self.member(name,kind)])
    def test_bounds(self):
        for members in [[self.member('release-manifest.json')]*2,[self.member('release-manifest.json',size=134217729)],[self.member('server/x')]]:
            with self.assertRaises(ValueError):module.validate(members)
if __name__=='__main__':unittest.main()
