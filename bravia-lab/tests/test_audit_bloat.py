import unittest
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from audit_bloat import assess

class SafeAuditTests(unittest.TestCase):
    def row(self,items,name='svc'):
        return {x['name']:x for x in assess(items)['items']}[name]
    def item(self,category='diagnostics',**kwargs):
        return dict(name='svc',category=category,**kwargs)
    def test_01_tuner_kept(self):self.assertEqual(self.row([self.item('tuner',evidence_verified=True)])['status'],'KEEP')
    def test_02_settings_kept(self):self.assertEqual(self.row([self.item('settings',evidence_verified=True)])['status'],'KEEP')
    def test_03_epg_kept(self):self.assertEqual(self.row([self.item('epg',evidence_verified=True)])['status'],'KEEP')
    def test_04_drm_kept(self):self.assertEqual(self.row([self.item('drm',evidence_verified=True)])['status'],'KEEP')
    def test_05_audio_kept(self):self.assertEqual(self.row([self.item('audio',evidence_verified=True)])['status'],'KEEP')
    def test_06_network_kept(self):self.assertEqual(self.row([self.item('network',evidence_verified=True)])['status'],'KEEP')
    def test_07_ota_kept(self):self.assertEqual(self.row([self.item('ota',evidence_verified=True)])['status'],'KEEP')
    def test_08_boot_kept(self):self.assertEqual(self.row([self.item('boot',evidence_verified=True)])['status'],'KEEP')
    def test_09_unknown_kept(self):self.assertEqual(self.row([self.item('unknown',evidence_verified=True)])['status'],'KEEP')
    def test_10_verified_app_hide_only(self):self.assertEqual(self.row([self.item('vendor-app',evidence_verified=True)])['status'],'HIDE_UI_FIRST')
    def test_11_unverified_app_kept(self):self.assertEqual(self.row([self.item('vendor-app')])['status'],'KEEP_PENDING_EVIDENCE')
    def test_12_optional_diagnostics_review(self):self.assertEqual(self.row([self.item(evidence_verified=True)])['status'],'REVIEW_DISABLE')
    def test_13_suspected_tracker_not_proof(self):self.assertEqual(self.row([self.item('optional-telemetry',evidence_verified=False,cpu_percent_observed=50)])['status'],'KEEP_PENDING_EVIDENCE')
    def test_14_dependency_blocks(self):
        a=[self.item(evidence_verified=True),{'name':'tv','category':'tuner','depends_on':['svc']}]
        self.assertEqual(self.row(a)['status'],'DEPENDENCY_REVIEW')
    def test_15_duplicates_rejected(self):
        with self.assertRaises(ValueError):assess([self.item(),self.item()])
    def test_16_empty_name_rejected(self):
        with self.assertRaises(ValueError):assess([{'name':''}])
    def test_17_not_list_rejected(self):
        with self.assertRaises(ValueError):assess({})
    def test_18_nonstrings_dep_rejected(self):
        with self.assertRaises(ValueError):assess([self.item(depends_on=[22])])
    def test_19_empty_inventory_valid(self):self.assertEqual(assess([])['component_count'],0)
    def test_20_no_destructive_plan(self):
        r=assess([self.item(evidence_verified=True)])
        self.assertEqual(r['mode'],'READ_ONLY_NO_CHANGES')
        self.assertNotIn('DELETE',str(r))
if __name__=='__main__':unittest.main()
