import unittest
import json
import server
import pytest
import copy
from server import app 

@pytest.fixture
def client(request):
    app.config["TESTING"] = True
    request.cls.client =  app.test_client()

@pytest.mark.usefixtures("client")
class CEPTestCase(unittest.TestCase):
    def test_submit_school(self):
        sobj = oceanside()
        sobj["sfa_certified"] = True
        sobj["hhfka_sixty"] = "less"
        result = self.client.post('/api/districts/optimize/', json = sobj)
        obj = result.json
        self.assertEqual(len(obj["schools"]) ,len(sobj["schools"]))
        self.assertTrue("strategies" in obj)
        self.assertEqual(obj["sfa_certified"],True)
        self.assertEqual(obj["hhfka_sixty"],"less")

    def test_lambda(self):
        from lambda_function import test_run
        import datetime
        sobj = oceanside()
        test_run(sobj,datetime.datetime.now())

    def test_no_district_name(self):
        sobj = oceanside()
        del sobj["name"]
        result = self.client.post('/api/districts/optimize/', json = sobj)

    def test_isp_threshold(self):
        sobj = oceanside()
        sobj["schools"] = sobj["schools"][:2]
        sobj["isp_threshold"] = "0.4"
        result = self.client.post('/api/districts/optimize/', json = sobj)
        obj = result.json
        self.assertEqual(obj["strategies"][0]["groups"][0]["isp_threshold"],0.4)

    def test_no_schools(self):
        # empty school list
        sobj = oceanside()
        sobj["schools"] = []
        result = self.client.post('/api/districts/optimize/', json = sobj)

    def test_max_groups(self):
        # empty school list
        sobj = oceanside(full_list=True)
        sobj["max_groups"] = 2
        result = self.client.post('/api/districts/optimize/', json = sobj)
        obj = result.json
        self.assertEqual(len(obj["strategies"][obj["best_index"]]["groups"]),2)

    def test_evaluate_by(self):
        # empty school list
        sobj = oceanside()
        sobj["evaluate_by"] = "coverage"
        result = self.client.post('/api/districts/optimize/', json = sobj)
        obj = result.json
        self.assertEqual(obj["evaluate_by"],"coverage")

    def test_bad_total_enrolled_field(self):
        sobj = oceanside()
        sobj["schools"][1]['total_enrolled'] = "NA"
        result = self.client.post('/api/districts/optimize/', json = sobj)

    def test_optimize_stream(self):
        """The streamed run must report every strategy and agree with optimize()."""
        sobj = oceanside()
        result = self.client.post('/api/districts/optimize-stream/', json = sobj)
        self.assertEqual(result.status_code,200)
        self.assertTrue("ndjson" in result.headers["Content-Type"])

        events = [json.loads(line) for line in result.data.decode().splitlines() if line.strip()]
        by_type = {}
        for e in events:
            by_type.setdefault(e["event"],[]).append(e)

        self.assertNotIn("error",by_type)
        self.assertEqual(len(by_type["start"]),1)
        self.assertEqual(len(by_type["done"]),1)

        # Every announced strategy has to start and finish, in order.
        announced = by_type["start"][0]["strategies"]
        self.assertEqual([e["name"] for e in by_type["strategy_start"]],announced)
        self.assertEqual([e["name"] for e in by_type["strategy_done"]],announced)

        # The terminal payload is what the blocking endpoint would have returned.
        streamed = by_type["done"][0]["result"]
        blocking = self.client.post('/api/districts/optimize/', json = oceanside()).json
        self.assertEqual(streamed["best_strategy"],blocking["best_strategy"])
        self.assertEqual(streamed["est_reimbursement"],blocking["est_reimbursement"])
        self.assertEqual(len(streamed["strategies"]),len(blocking["strategies"]))

        # Per-strategy scores must match the ones in the final result, so a
        # "best so far" built from the stream cannot disagree with the winner.
        final = {s["name"]:s["reimbursement"] for s in streamed["strategies"]}
        for e in by_type["strategy_done"]:
            self.assertEqual(e["reimbursement"],final[e["name"]])

    def test_optimize_stream_no_schools(self):
        """A rejected payload fails before streaming starts, as plain JSON."""
        sobj = oceanside()
        sobj["schools"] = []
        result = self.client.post('/api/districts/optimize-stream/', json = sobj)
        self.assertEqual(result.status_code,200)
        self.assertTrue("error" in result.json)

    def test_broken_json(self):
        sobj = oceanside()
        result = self.client.post('/api/districts/optimize/', data = "{Broken JSON}")
        self.assertEqual(result.status_code,200)
        self.assertTrue("error" in result.json)

    def test_empty_schools(self):
        # https://sentry.io/organizations/mealscount-dev/issues/2432273179/
        for_lambda = {
           "code": 'District Name', 
            "name": 'District Name', 
            "schools": [{
                "daily_breakfast_served": 0, 
                "daily_lunch_served": 0, 
                "school_code": '', 
                "school_name": '', 
                "severe_need": False, 
                "total_eligible": 0, 
                "total_enrolled": 0
            } for i in range(8)],
            "state_code": 'AL', 
            "strategies_to_run": [
                'Pairs', 
                'OneToOne', 
                'Exhaustive', 
                'OneGroup', 
                'Spread', 
                'Binning', 
                'NYCMODA?fresh_starts=50&iterations=1000', 
                'GreedyLP'
            ]
        }
        from lambda_function import test_run
        import datetime
        result = test_run(for_lambda,datetime.datetime.now())
        # Testing for an exception which does not seem to be happening.
        #self.assertEqual(result,1)

    def test_school_with_no_enrolled(self):
        # https://sentry.io/organizations/mealscount-dev/issues/2432273179/
        for_lambda = {
           "code": 'District Name', 
            "name": 'District Name', 
            "schools": [{
                "daily_breakfast_served": 500, 
                "daily_lunch_served": 800, 
                "school_code": 'XYZ', 
                "school_name": 'XYZ', 
                "severe_need": False, 
                "total_eligible": 1000, 
                "total_enrolled": 0 # Seen this.
            } for i in range(2)],
            "state_code": 'MI', 
            "strategies_to_run": [
                'Pairs', 
            ]
        }
        from lambda_function import test_run
        import datetime
        result = test_run(for_lambda,datetime.datetime.now())

    def test_max_groups_and_evalby_none(self):
        # https://sentry.io/organizations/mealscount-dev/issues/3555682831/
        for_lambda = {
           "code": 'District Name', 
            "name": 'District Name', 
            "schools": [{
                "daily_breakfast_served": 500, 
                "daily_lunch_served": 800, 
                "school_code": 'XYZ', 
                "school_name": 'XYZ', 
                "severe_need": False, 
                "total_eligible": 1000, 
                "total_enrolled": 0 # Seen this.
            } for i in range(2)],
            "state_code": 'MI', 
            "strategies_to_run": [
                'Pairs', 
            ],
            "max_groups":None,
            #"evaluate_by":None,
        }
        from lambda_function import test_run
        import datetime
        result = test_run(for_lambda,datetime.datetime.now())
  
# Mostly accurate, severe need is not accurate
class CompareTestCase(unittest.TestCase):
    '''/api/districts/compare/ runs the main-branch optimizer beside the current
    one. The value of the endpoint rests on both sides seeing identical input and
    identical scoring, so that is what these pin down.'''

    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def compare(self,payload):
        return self.client.post('/api/districts/compare/', json=payload).json

    def test_both_sides_run_and_agree_on_the_district(self):
        obj = self.compare(oceanside())
        self.assertNotIn("error",obj)
        for side in ("baseline","improved"):
            self.assertIn(side,obj)
            self.assertGreater(obj[side]["est_reimbursement"],0)
            # Schools are sent once at the top level, not duplicated per side.
            self.assertNotIn("schools",obj[side])
        self.assertEqual(obj["school_count"],len(obj["schools"]))
        self.assertEqual(obj["baseline"]["total_enrolled"],obj["improved"]["total_enrolled"])

    def test_baseline_is_the_main_branch_strategy_set(self):
        '''If this drifts, the comparison stops meaning what it claims.'''
        obj = self.compare(oceanside())
        names = [s.split("?")[0] for s in obj["baseline"]["strategies_run"]]
        self.assertEqual(names,["Pairs","OneToOne","Exhaustive","OneGroup","Spread","Binning"])
        self.assertNotIn("Exact",names)

    def test_delta_is_improved_minus_baseline(self):
        obj = self.compare(oceanside())
        expected = obj["improved"]["est_reimbursement"] - obj["baseline"]["est_reimbursement"]
        self.assertAlmostEqual(obj["delta"]["reimbursement"],expected,places=2)
        self.assertEqual(obj["delta"]["same_result"],abs(expected) < 0.01)

    def test_improved_side_proves_optimality_on_a_small_district(self):
        obj = self.compare(oceanside())
        self.assertTrue(obj["improved"]["best_is_optimal"])
        self.assertFalse(obj["baseline"]["best_is_optimal"])
        self.assertTrue(obj["delta"]["newly_proven_optimal"])

    def test_improved_never_loses_to_baseline_on_a_small_district(self):
        '''Below the Exact ceiling the improved side is provably optimal, so it
        cannot be beaten by the baseline. A failure here is a real regression.'''
        obj = self.compare(oceanside())
        self.assertGreaterEqual(
            obj["improved"]["est_reimbursement"],obj["baseline"]["est_reimbursement"] - 0.01)

    def test_percent_is_null_when_baseline_earned_nothing(self):
        '''No grouping qualified, so a percentage change has no meaning.'''
        sobj = oceanside()
        for school in sobj["schools"]:
            school["total_eligible"] = 1
        obj = self.compare(sobj)
        self.assertEqual(obj["baseline"]["est_reimbursement"],0)
        self.assertIsNone(obj["delta"]["percent"])

    def test_no_schools_is_a_reported_error_not_a_crash(self):
        obj = self.compare({"name":"x","code":"x","state_code":"ca","schools":[]})
        self.assertIn("error",obj)


def oceanside(full_list=False):
    return copy.deepcopy({
    "name":"Oceanside Unified School District",
    "code":"02494",
    "total_enrolled":17990,
    "overall_isp":0.2758198999444136,
    "school_count":25,
    "best_strategy":None,
    "sfa_certified":True,
    "hhfka_sixty": "less",
    "est_reimbursement":0,
    "rates":{"free_lunch":3.41,"paid_lunch":0.32,"free_bfast":1.84,"paid_bfast":0.31},
    "schools":[
        {"school_code":"37735690113522","school_name":"Cesar Chavez Middle","school_type":"n/a","total_enrolled":716,"total_eligible":296,"daily_breakfast_served":107,"daily_lunch_served":394,"isp":0.4134,"active":True,"grouping":None,"severe_need":True},
        {"school_code":"37735696108211","school_name":"CHRISTA MCAULIFFE ELEMENTARY","school_type":"n/a","total_enrolled":545,"total_eligible":97,"daily_breakfast_served":82,"daily_lunch_served":300,"isp":0.178,"active":True,"grouping":None,"severe_need":True},
        {"school_code":"9367","school_name":"Clair W. Burgener Academy","school_type":"n/a","total_enrolled":229,"total_eligible":0,"daily_breakfast_served":34,"daily_lunch_served":126,"isp":0,"active":True,"grouping":None,"severe_need":True},
        {"school_code":"37735696088991","school_name":"DEL RIO ELEMENTARY","school_type":"n/a","total_enrolled":335,"total_eligible":140,"daily_breakfast_served":50,"daily_lunch_served":184,"isp":0.4179,"active":True,"grouping":None,"severe_need":False},
        {"school_code":"8514","school_name":"DITMAR ELEMENTARY","school_type":"n/a","total_enrolled":3,"total_eligible":0,"daily_breakfast_served":0,"daily_lunch_served":2,"isp":0,"active":True,"grouping":None,"severe_need":True},
        # uncomment to slow tests down a lot
        {"school_code":"37735696069108","school_name":"E. G. Garrison Elementary","school_type":"n/a","total_enrolled":350,"total_eligible":111,"daily_breakfast_served":53,"daily_lunch_served":193,"isp":0.3171,"active":True,"grouping":None,"severe_need":False},
        {"school_code":"37735693739018","school_name":"El Camino High","school_type":"n/a","total_enrolled":2958,"total_eligible":700,"daily_breakfast_served":444,"daily_lunch_served":1627,"isp":0.2366,"active":True,"grouping":None,"severe_need":True},
        {"school_code":"37735696109995","school_name":"Ivey Ranch Elementary","school_type":"n/a","total_enrolled":700,"total_eligible":98,"daily_breakfast_served":105,"daily_lunch_served":385,"isp":0.14,"active":True,"grouping":None,"severe_need":False},
        {"school_code":"37735696038830","school_name":"Jefferson Middle","school_type":"n/a","total_enrolled":580,"total_eligible":287,"daily_breakfast_served":87,"daily_lunch_served":319,"isp":0.4948,"active":True,"grouping":None,"severe_need":True},
        {"school_code":"37735696038848","school_name":"LAUREL ELEMENTARY","school_type":"n/a","total_enrolled":445,"total_eligible":231,"daily_breakfast_served":67,"daily_lunch_served":245,"isp":0.5191,"active":True,"grouping":None,"severe_need":False},
        {"school_code":"37735696038855","school_name":"Libby Elementary","school_type":"n/a","total_enrolled":500,"total_eligible":222,"daily_breakfast_served":75,"daily_lunch_served":275,"isp":0.444,"active":True,"grouping":None,"severe_need":True}
    ][:(full_list and 20 or 5)],
    "state_code": "ca"
    })




def test_large_districts_run_genetic_last_by_default():
    names = [s.split("?")[0] for s in server.default_strategies(40,"reimbursement",10)]
    assert names[-1] == "Genetic"
    assert "CPSAT" not in names

def test_extended_search_gives_all_its_time_to_parallel_genetic():
    specs = server.default_strategies(40,"reimbursement",10,extended_seconds=540)
    names = [s.split("?")[0] for s in specs]
    assert names[-2:] == ["Genetic","Genetic"] and "CPSAT" not in names
    # The quick run comes first, unchanged, so its answer shows up early.
    assert specs[-2] == server.default_strategies(40,"reimbursement",10)[-1]
    # The whole budget, with no stop rule, one run per core.
    assert "time_limit=540" in specs[-1] and "patience=0" in specs[-1] and "generations=0" in specs[-1]
    assert "workers=0" in specs[-1]

def test_normal_run_keeps_the_genetic_stop_rule():
    genetic = server.default_strategies(40,"reimbursement",10)[-1]
    assert genetic.startswith("Genetic?") and "patience" not in genetic and "time_limit" not in genetic
    assert "workers" not in genetic

def test_extended_search_ignored_where_exact_proves_the_optimum():
    names = [s.split("?")[0] for s in server.default_strategies(12,"reimbursement",10,extended_seconds=540)]
    assert "Exact" in names and "CPSAT" not in names and "Genetic" not in names

def test_extended_search_minutes_default_and_bounds():
    secs = server.extended_search_seconds
    assert secs({}) is None
    assert secs({"extended_search":False,"extended_search_minutes":20}) is None
    assert secs({"extended_search":True}) == 9 * 60
    assert secs({"extended_search":True,"extended_search_minutes":20}) == 20 * 60
    assert secs({"extended_search":True,"extended_search_minutes":"25"}) == 25 * 60
    # Out of range is clamped server-side, whatever the UI allowed through.
    assert secs({"extended_search":True,"extended_search_minutes":3}) == 9 * 60
    assert secs({"extended_search":True,"extended_search_minutes":600}) == 30 * 60
    assert secs({"extended_search":True,"extended_search_minutes":"lots"}) == 9 * 60
