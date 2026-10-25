"""Stage16 OFFLINE simulator tests. No Sony SDK/DRM/hardware required."""
import pathlib, subprocess, unittest, shutil, re
HERE=pathlib.Path(__file__).resolve().parent
def call(script='', demo=False):
    argv=[str(HERE/'console'),'--script',script]
    if demo:argv.append('--demo')
    r=subprocess.run(argv,check=True,text=True,capture_output=True,timeout=10)
    return r.stdout
class SimulatorCli(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run(['make','-C',str(HERE),'test','arm'],check=True,capture_output=True,text=True,timeout=30)
        subprocess.run(['sh',str(HERE/'build_arm.sh')],check=True,capture_output=True,text=True,timeout=30)
    def test_tv_native_not_fake(self):self.assertIn('owner=tv',call(''))
    def test_home_focus(self):self.assertIn('owner=home view=1 area=0',call('h'))
    def test_known_service_demo_only(self):self.assertIn('owner=app',call('hsdddo',True))
    def test_unknown_service_rejected(self):
        s=call('hso');self.assertIn('denied=1',s);self.assertIn('feedback=2',s)
    def test_not_registered_blocked_without_mock_dispatch(self):
        s=call('hsddddsddddo',True);self.assertIn('feedback=1',s);self.assertIn('denied=0',s)
    def test_mock_app_back(self):
        s=call('hsdddob',True);self.assertIn('owner=home',s);self.assertIn('last-app=3',s)
    def test_native_menu_owns_screen(self):
        s=call('hsssddo',True);self.assertIn('owner=native-menu',s);self.assertIn('menu=2',s)
    def test_native_menu_back(self):self.assertIn('owner=home',call('hsssddob',True))
    def test_tv_back(self):self.assertIn('owner=tv',call('hb'))
    def test_forward_reserved_key(self):self.assertIn('forwarded=1',call('h+'))
    def test_zero_draw_on_tv(self):self.assertIn('draw=0',call(''))
    def test_no_draw_on_active_app(self):self.assertRegex(call('hsdddo',True),r'owner=app[^\n]*draw=0')
    def test_skip_identical_frame(self):self.assertIn('skipped=',call('hh'))
    def test_invalid_key_exit_code(self):
        x=subprocess.run([str(HERE/'console'),'--script','?'],text=True,capture_output=True)
        self.assertEqual(x.returncode,2)
    def test_benchmark_100000(self):
        x=subprocess.run([str(HERE/'console'),'--benchmark','100000'],text=True,capture_output=True,check=True,timeout=15)
        self.assertIn('events=100000',x.stdout)
        self.assertRegex(x.stdout,r'us_per_event=[0-9]+\.[0-9]+')
    def test_real_arm_exec_binary(self):
        x=subprocess.check_output(['readelf','-h',str(HERE/'build/bravia-stage16-simulator-armv7-linux-elf')],text=True)
        self.assertIn('EXEC (Executable file)',x);self.assertIn('ARM',x)
    def test_arm_has_no_dynamic_loader(self):
        x=subprocess.check_output(['readelf','-W','-l',str(HERE/'build/bravia-stage16-simulator-armv7-linux-elf')],text=True)
        self.assertNotIn('INTERP',x)
    def test_arm_no_unknown_calls(self):
        x=subprocess.check_output(['readelf','-W','-s',str(HERE/'build/bravia-stage16-simulator-armv7-linux-elf')],text=True)
        unresolved=[line for line in x.splitlines() if re.search(r'\bUND\b',line) and 'GLOBAL' in line]
        self.assertFalse(unresolved)
    def test_optional_qemu_exec(self):
        qemu=shutil.which('qemu-arm')
        if not qemu:self.skipTest('qemu-arm not installed; CI installs qemu-user')
        x=subprocess.run([qemu,str(HERE/'build/bravia-stage16-simulator-armv7-linux-elf')],input='hsdddobq',text=True,capture_output=True,check=True,timeout=15)
        self.assertIn('SIM owner=app',x.stdout);self.assertIn('last=3',x.stdout)
    def test_source_has_no_sony_ipc_writes(self):
        source=(HERE/'sim.c').read_text()+(HERE/'arm_main.c').read_text()
        for prohibited in ('am_client_init(', 'am_send_cmd(', 'socket(', '/dev/mmcblk', '/3rd_rw'):
            self.assertNotIn(prohibited,source)
if __name__=='__main__':unittest.main(verbosity=2)
