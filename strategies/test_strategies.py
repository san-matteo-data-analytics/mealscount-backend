from . import STRATEGIES
import unittest
import random
import time
from .base import CEPDistrict,CEPSchool,CEPGroup,CEPRate
from cep_estimatory import parse_strategy

SCHOOL_DATA_COLS = ["District Code","School Name","School Code",\
                    "foster","homeless","migrant","direct_cert",\
                    "frpm","total_enrolled"]

class CEPTestMixin(object):
    '''Mixin for reusable school / district building code for tests''' 
    def mk_school(self,district,code,isp,total_enrolled,bkfst,lunch):
        return CEPSchool({
            "District Name":district.name,
            "District Code":district.code,
            "School Name":"School %s" % code,
            "School Code":"BASIC-%s" % code,
            "School Type":"Test (Public)",
            "direct_cert": isp*total_enrolled,
            "total_enrolled": total_enrolled,
            "include_in_mealscount": "true",
            "daily_breakfast_served": bkfst,
            "daily_lunch_served": lunch,
        })

    def create_default_districts(self):
        basic = CEPDistrict(name="Basic District",code="BASIC")
        basic.add_school(self.mk_school(basic,"A",0.85,1000,300,500))
        basic.add_school(self.mk_school(basic,"A",0.625,1000,200,600))
        basic.add_school(self.mk_school(basic,"B",0.40,1000,500,500))
        basic.add_school(self.mk_school(basic,"C",0.25,1000,100,400))
        return basic
 
class CEPTestCase(unittest.TestCase,CEPTestMixin):
    '''Tests basic python data model (CEPSchool,CEPDistrict,CEPGroup)'''

    def test_district(self):
        district = self.create_default_districts()
        self.assertEqual(len(district.schools),4)
        self.assertEqual(district.total_enrolled,4000)
        self.assertEqual( district.total_enrolled, sum([s.total_enrolled for s in district.schools]))
        self.assertEqual(
            district.overall_isp,
            (850+625+400+250)/4000.0
        )

    def test_school(self):
        s = CEPSchool( {
            "District Name":"Test District",
            "District Code":"TEST-D",
            "School Name":"Test School",
            "School Code": "TEST-S",
            "School Type":"Test (Public)",
            "total_enrolled": 1000,
            "direct_cert": 500,
            "daily_breakfast_served":200,
            "daily_lunch_served": 600,
        }) 
        self.assertEqual(s.total_eligible,500) # We actually are now using direct_cert for baseline eligible
        self.assertEqual(s.isp,0.5)

    def test_reimbursement_calculation(self):
        d = CEPDistrict(name="Test",code="TEST")
        s = CEPSchool( {
            "District Name":d.name,
            "District Code":d.code,
            "School Name":"Test School",
            "School Code": "TEST-S",
            "School Type":"Test (Public)",
            "total_enrolled": 1000,
            "direct_cert": 450,
            "daily_breakfast_served":200,
            "daily_lunch_served": 600,
        }) 
        g = CEPGroup(d,"Test Group",[s])

        # Test Against usda-cep-estimator-worksheet 18-19.xlsx
        self.assertEqual(g.isp,0.45)
        # For some reason the float division doens't get us exactly this
        self.assertAlmostEqual(g.free_rate,0.72)
        self.assertAlmostEqual(g.paid_rate,0.28)

    def test_rate_determination(self):
        # State, SFA, 60%, Severe Need 
        r = CEPRate("ak",True,"more",True)
        self.assertEqual(r.paid_lunch_rate,0.68)
        self.assertEqual(r.free_breakfast_rate,4.39)
        r = CEPRate("ny",True,"less",False)
        self.assertEqual(r.free_breakfast_rate,2.28)
        self.assertEqual(r.paid_lunch_rate,0.40)
        r = CEPRate("tx",True,"max",True)
        self.assertEqual(r.paid_breakfast_rate,0.38)
        self.assertEqual(r.free_lunch_rate,4.42)
    
    def test_group(self):
        district = self.create_default_districts()
        # Create a singular group to test group metrics
        g = CEPGroup(district, "High ISP", district.schools[:2],0.4)
        s1,s2 = g.schools
        self.assertEqual(g.isp, (s1.total_eligible + s2.total_eligible) / (s1.total_enrolled + s2.total_enrolled) )
        self.assertEqual(g.free_rate, 1 ) # We are over 1 for isp * 1.6
        self.assertEqual(g.paid_rate, 0 )

        g2 = CEPGroup(district, "Low ISP", district.schools[2:],0.4)
        s1,s2 = g2.schools
        self.assertEqual(g2.isp, (s1.total_eligible + s2.total_eligible) / (s1.total_enrolled + s2.total_enrolled) )
        self.assertEqual(g2.free_rate, 0 )
        self.assertEqual(g2.paid_rate, 0 )



class StrategyTestCase(unittest.TestCase,CEPTestMixin):
    '''Runs through all registerd strategies and tests them. You can add custom per-strategy test
    cases by setting up a test_districts data member
    '''
    def setUp(self):
        self.test_districts = []
        self.create_default_districts()
        self.test_districts.append(self.create_default_districts())

    def test_strategies(self):
        for strategy_class in STRATEGIES.values():
            if hasattr(strategy_class,"test_districts"):
                test_districts = strategy_class.test_data 
            else:
                test_districts = self.test_districts

            for d in test_districts:
                d.strategies = [strategy_class()]
                d.run_strategies()
                for s in d.strategies: 
                    # Verify our strategy gave us groups of schools totalling the total number
                    # of schools
                    self.assertEqual(sum([len(g.schools) for g in s.groups]),len(d.schools))

            # TODO how does a strategy define its expected result?



class ExactStrategyTestCase(unittest.TestCase,CEPTestMixin):
    '''The Exact strategy claims provable optimality, so it is worth pinning down.'''

    def mk_district(self,specs,**kwargs):
        d = CEPDistrict(name="Exact District",code="EXACT",**kwargs)
        for i,(isp,enrolled,bkfst,lunch) in enumerate(specs):
            d.add_school(self.mk_school(d,str(i),isp,enrolled,bkfst,lunch))
        return d

    def run_strategy(self,district,spec):
        Klass,params,name = parse_strategy(spec)
        s = Klass(params,name)
        district.strategies = [s]
        district.run_strategies()
        return s

    def test_matches_exhaustive(self):
        '''Same answer as brute force, on districts small enough for both.'''
        rnd = random.Random(4242)
        for _ in range(12):
            specs = [(rnd.uniform(0.05,0.6),rnd.randint(100,1200),
                      rnd.randint(0,300),rnd.randint(0,600))
                     for _ in range(rnd.randint(2,6))]
            exhaustive = self.run_strategy(self.mk_district(specs),"Exhaustive")
            exact = self.run_strategy(self.mk_district(specs),"Exact")
            self.assertAlmostEqual(exact.reimbursement,exhaustive.reimbursement,places=2)
            self.assertTrue(exact.optimal)

    def test_partitions_every_school_once(self):
        district = self.mk_district([(0.9,500,100,300),(0.5,800,200,500),
                                     (0.2,300,50,150),(0.1,200,40,120)])
        exact = self.run_strategy(district,"Exact")
        placed = sorted(s.code for g in exact.groups for s in g.schools)
        self.assertEqual(placed,sorted(s.code for s in district.schools))

    def test_high_isp_shortcut_is_one_group(self):
        '''At or above 62.5% ISP a single group is fully funded, so no search.'''
        district = self.mk_district([(0.8,500,100,300),(0.9,700,200,400)])
        exact = self.run_strategy(district,"Exact")
        self.assertEqual(len(exact.groups),1)
        self.assertTrue(exact.optimal)
        self.assertIn("62.5%",exact.optimality_basis)

    def test_declines_oversized_district_without_crashing(self):
        '''Above the limit it reports nothing rather than guessing.'''
        specs = [(0.3,500,100,300)] * 8
        district = self.mk_district(specs)
        exact = self.run_strategy(district,"Exact?max_schools=4")
        self.assertIsNone(exact.groups)
        self.assertFalse(exact.optimal)
        # as_dict must survive a strategy that produced no groups
        d = district.as_dict()
        self.assertEqual(d["strategies"][0]["groups"],[])
        self.assertIsNone(d["best_index"])

    def test_respects_max_groups(self):
        specs = [(0.9,400,80,240),(0.75,500,90,300),(0.15,600,100,360),(0.1,300,50,180)]
        district = self.mk_district(specs)
        exact = self.run_strategy(district,"Exact?max_groups=2")
        self.assertIsNotNone(exact.groups)
        self.assertLessEqual(len(exact.groups),2)

    def test_reported_value_matches_rescoring(self):
        '''The dollars it claims must survive re-scoring by CEPGroup itself.'''
        district = self.mk_district([(0.85,520,291,411),(0.4,450,158,315),
                                     (0.22,380,95,228),(0.5,600,200,400)])
        exact = self.run_strategy(district,"Exact")
        rescored = sum(
            CEPGroup(district,"g%i"%i,list(g.schools)).est_reimbursement()
            for i,g in enumerate(exact.groups))
        self.assertAlmostEqual(exact.reimbursement,rescored,places=2)


class IntervalDPStrategyTestCase(unittest.TestCase,CEPTestMixin):
    '''IntervalDP is a restricted search, so what matters is that it never lies:
    it must partition every school once, report dollars that survive re-scoring,
    and never claim to beat the provable optimum.
    '''

    def mk_district(self,specs,**kwargs):
        d = CEPDistrict(name="DP District",code="DP",**kwargs)
        for i,(isp,enrolled,bkfst,lunch) in enumerate(specs):
            d.add_school(self.mk_school(d,str(i),isp,enrolled,bkfst,lunch))
        return d

    def run_strategy(self,district,spec):
        Klass,params,name = parse_strategy(spec)
        s = Klass(params,name)
        district.strategies = [s]
        district.run_strategies()
        return s

    def random_specs(self,rnd,n):
        '''Meals scale with enrollment -- a school cannot serve more lunches than
        it has students, and the contiguity assumption is only meaningful on
        physically possible data.'''
        specs = []
        for _ in range(n):
            enrolled = rnd.randint(100,1200)
            specs.append((rnd.uniform(0.05,0.62), enrolled,
                          round(enrolled*0.2852*rnd.uniform(0.7,1.3)),
                          round(enrolled*0.5998*rnd.uniform(0.7,1.3))))
        return specs

    def test_never_beats_the_proven_optimum(self):
        '''A restricted search that outscores Exact would mean one of them is wrong.'''
        rnd = random.Random(2024)
        for _ in range(25):
            specs = self.random_specs(rnd,rnd.randint(2,9))
            exact = self.run_strategy(self.mk_district(specs),"Exact")
            dp = self.run_strategy(self.mk_district(specs),"IntervalDP")
            self.assertLessEqual(dp.reimbursement,exact.reimbursement + 0.02)

    def test_partitions_every_school_once(self):
        district = self.mk_district([(0.9,500,100,300),(0.5,800,200,500),
                                     (0.2,300,50,150),(0.1,200,40,120)])
        dp = self.run_strategy(district,"IntervalDP")
        placed = sorted(s.code for g in dp.groups for s in g.schools)
        self.assertEqual(placed,sorted(s.code for s in district.schools))

    def test_reported_value_matches_rescoring(self):
        '''The DP scores blocks itself, so it must agree with CEPGroup to the cent.'''
        district = self.mk_district([(0.85,520,148,312),(0.4,450,128,270),
                                     (0.22,380,108,228),(0.5,600,171,360)])
        dp = self.run_strategy(district,"IntervalDP")
        rescored = sum(
            CEPGroup(district,"g%i"%i,list(g.schools)).est_reimbursement()
            for i,g in enumerate(dp.groups))
        self.assertAlmostEqual(dp.reimbursement,rescored,places=2)

    def test_high_isp_shortcut_is_one_group(self):
        district = self.mk_district([(0.8,500,143,300),(0.9,700,200,420)])
        dp = self.run_strategy(district,"IntervalDP")
        self.assertEqual(len(dp.groups),1)
        self.assertTrue(dp.optimal)

    def test_respects_max_groups(self):
        specs = [(0.9,400,114,240),(0.75,500,143,300),
                 (0.15,600,171,360),(0.1,300,86,180)]
        dp = self.run_strategy(self.mk_district(specs),"IntervalDP?max_groups=2")
        self.assertIsNotNone(dp.groups)
        self.assertLessEqual(len(dp.groups),2)

    def test_max_block_still_covers_every_school(self):
        '''Capping block width bounds run time on huge districts; it must not
        drop schools on the floor.'''
        rnd = random.Random(7)
        district = self.mk_district(self.random_specs(rnd,20))
        dp = self.run_strategy(district,"IntervalDP?max_block=3")
        placed = sorted(s.code for g in dp.groups for s in g.schools)
        self.assertEqual(placed,sorted(s.code for s in district.schools))
        self.assertTrue(all(len(g.schools) <= 3 for g in dp.groups))

    def test_scales_past_the_exact_ceiling(self):
        '''The whole point: it answers where Exact declines to.'''
        rnd = random.Random(11)
        district = self.mk_district(self.random_specs(rnd,120))
        dp = self.run_strategy(district,"IntervalDP")
        self.assertEqual(sum(len(g.schools) for g in dp.groups),120)
        self.assertFalse(dp.optimal)  # contiguous-optimal only, and it says so
        self.assertIn("contiguous",dp.optimality_basis)


class CPSATStrategyTestCase(unittest.TestCase,CEPTestMixin):
    '''CPSAT claims optimality when the solver proves it, and promises never to
    return less than the grouping it was warm-started from.'''

    def mk_district(self,specs,**kwargs):
        d = CEPDistrict(name="CPSAT District",code="CPSAT",**kwargs)
        for i,(isp,enrolled,bkfst,lunch) in enumerate(specs):
            d.add_school(self.mk_school(d,str(i),isp,enrolled,bkfst,lunch))
        return d

    def run_strategy(self,district,spec,before=()):
        '''Run spec last, after any strategies in before, as the server would.'''
        strategies = []
        for s in tuple(before) + (spec,):
            Klass,params,name = parse_strategy(s)
            strategies.append(Klass(params,name))
        district.strategies = strategies
        district.run_strategies()
        return strategies[-1]

    def random_specs(self,rnd,n):
        specs = []
        for _ in range(n):
            enrolled = rnd.randint(100,1200)
            specs.append((rnd.uniform(0.05,0.62), enrolled,
                          round(enrolled*0.2852*rnd.uniform(0.7,1.3)),
                          round(enrolled*0.5998*rnd.uniform(0.7,1.3))))
        return specs

    def test_matches_exact(self):
        '''Same optimum as the subset DP, on districts small enough for both.'''
        rnd = random.Random(5150)
        for _ in range(12):
            specs = self.random_specs(rnd,rnd.randint(2,8))
            exact = self.run_strategy(self.mk_district(specs),"Exact")
            cpsat = self.run_strategy(self.mk_district(specs),"CPSAT?time_limit=30")
            self.assertAlmostEqual(cpsat.reimbursement,exact.reimbursement,delta=0.05)
            self.assertTrue(cpsat.optimal)

    def test_matches_exact_on_coverage(self):
        rnd = random.Random(77)
        for _ in range(6):
            specs = self.random_specs(rnd,rnd.randint(3,7))
            exact = self.run_strategy(self.mk_district(specs),"Exact?evaluate_by=coverage")
            cpsat = self.run_strategy(self.mk_district(specs),"CPSAT?evaluate_by=coverage&time_limit=30")
            self.assertEqual(cpsat.students_covered,exact.students_covered)

    def test_never_worse_than_its_warm_start(self):
        '''Given almost no time on a large district it may not improve, but it
        must hand back at least what the earlier strategies found.'''
        rnd = random.Random(31)
        specs = self.random_specs(rnd,60)
        district = self.mk_district(specs)
        cpsat = self.run_strategy(district,"CPSAT?time_limit=1&max_groups=10",
                                  before=("Spread","Binning","Pairs"))
        prior = max(s.reimbursement for s in district.strategies[:-1] if len(s.groups) <= 10)
        self.assertGreaterEqual(cpsat.reimbursement,prior - 0.005)
        self.assertLessEqual(len(cpsat.groups),10)

    def test_partitions_every_school_once(self):
        district = self.mk_district([(0.9,500,100,300),(0.5,800,200,500),
                                     (0.2,300,50,150),(0.1,200,40,120)])
        cpsat = self.run_strategy(district,"CPSAT?time_limit=10")
        placed = sorted(s.code for g in cpsat.groups for s in g.schools)
        self.assertEqual(placed,sorted(s.code for s in district.schools))

    def test_respects_max_groups(self):
        specs = [(0.9,400,80,240),(0.75,500,90,300),(0.15,600,100,360),(0.1,300,50,180)]
        cpsat = self.run_strategy(self.mk_district(specs),"CPSAT?max_groups=2&time_limit=10")
        self.assertLessEqual(len(cpsat.groups),2)
        exact = self.run_strategy(self.mk_district(specs),"Exact?max_groups=2")
        self.assertAlmostEqual(cpsat.reimbursement,exact.reimbursement,delta=0.05)

    def test_reported_value_matches_rescoring(self):
        district = self.mk_district([(0.85,520,291,411),(0.4,450,158,315),
                                     (0.22,380,95,228),(0.5,600,200,400)])
        cpsat = self.run_strategy(district,"CPSAT?time_limit=10")
        rescored = sum(
            CEPGroup(district,"g%i"%i,list(g.schools)).est_reimbursement()
            for i,g in enumerate(cpsat.groups))
        self.assertAlmostEqual(cpsat.reimbursement,rescored,places=2)

    def test_high_isp_shortcut_is_one_group(self):
        district = self.mk_district([(0.8,500,100,300),(0.9,700,200,400)])
        cpsat = self.run_strategy(district,"CPSAT")
        self.assertEqual(len(cpsat.groups),1)
        self.assertTrue(cpsat.optimal)

    def test_reports_gap_when_not_proven(self):
        '''Stopped short of proof, it says how far off it could be rather than
        claiming optimality.'''
        rnd = random.Random(8)
        district = self.mk_district(self.random_specs(rnd,80))
        cpsat = self.run_strategy(district,"CPSAT?time_limit=2&max_groups=10")
        self.assertEqual(sum(len(g.schools) for g in cpsat.groups),80)
        if not cpsat.optimal:
            self.assertIn("no grouping can earn more than",cpsat.optimality_basis)


class GeneticStrategyTestCase(unittest.TestCase,CEPTestMixin):
    '''Genetic proves nothing, so what matters is that it never lies: it must
    not beat the proven optimum, must place every school once, must hand back
    at least its warm start, and must be repeatable for a fixed seed.'''

    mk_district = CPSATStrategyTestCase.mk_district
    run_strategy = CPSATStrategyTestCase.run_strategy
    random_specs = CPSATStrategyTestCase.random_specs

    def test_never_beats_and_usually_matches_exact(self):
        rnd = random.Random(5150)
        hits, ratios = 0, []
        for _ in range(20):
            specs = self.random_specs(rnd,rnd.randint(2,9))
            exact = self.run_strategy(self.mk_district(specs),"Exact")
            ga = self.run_strategy(self.mk_district(specs),"Genetic")
            self.assertLessEqual(ga.reimbursement,exact.reimbursement + 0.05)
            ratios.append(ga.reimbursement / exact.reimbursement if exact.reimbursement else 1)
            hits += abs(ga.reimbursement - exact.reimbursement) <= 0.05
        self.assertGreaterEqual(hits,18)              # small districts: nearly always optimal
        self.assertGreater(min(ratios),0.99)

    def test_coverage_never_beats_exact(self):
        rnd = random.Random(77)
        for _ in range(6):
            specs = self.random_specs(rnd,rnd.randint(3,7))
            exact = self.run_strategy(self.mk_district(specs),"Exact?evaluate_by=coverage")
            ga = self.run_strategy(self.mk_district(specs),"Genetic?evaluate_by=coverage")
            self.assertLessEqual(ga.students_covered,exact.students_covered)

    def test_partitions_and_respects_max_groups(self):
        rnd = random.Random(3)
        district = self.mk_district(self.random_specs(rnd,40))
        ga = self.run_strategy(district,"Genetic?max_groups=6&generations=20")
        placed = sorted(s.code for g in ga.groups for s in g.schools)
        self.assertEqual(placed,sorted(s.code for s in district.schools))
        self.assertLessEqual(len(ga.groups),6)
        self.assertTrue(all(g.schools for g in ga.groups))

    def test_not_worse_than_warm_start(self):
        rnd = random.Random(31)
        district = self.mk_district(self.random_specs(rnd,60))
        ga = self.run_strategy(district,"Genetic?max_groups=10&generations=5",
                               before=("Spread","Binning","Pairs"))
        prior = max(s.reimbursement for s in district.strategies[:-1] if len(s.groups) <= 10)
        self.assertGreaterEqual(ga.reimbursement,prior - 0.05)

    def test_reported_value_matches_rescoring(self):
        rnd = random.Random(12)
        district = self.mk_district(self.random_specs(rnd,25))
        ga = self.run_strategy(district,"Genetic?generations=20")
        rescored = sum(
            CEPGroup(district,"g%i"%i,list(g.schools)).est_reimbursement()
            for i,g in enumerate(ga.groups))
        self.assertAlmostEqual(ga.reimbursement,rescored,places=2)

    def test_deterministic_for_a_seed(self):
        specs = self.random_specs(random.Random(21),30)
        runs = [self.run_strategy(self.mk_district(specs),"Genetic?seed=7&generations=30")
                for _ in range(2)]
        self.assertEqual(runs[0].reimbursement,runs[1].reimbursement)
        self.assertEqual(
            sorted(sorted(s.code for s in g.schools) for g in runs[0].groups),
            sorted(sorted(s.code for s in g.schools) for g in runs[1].groups))

    def test_high_isp_shortcut_is_one_group(self):
        district = self.mk_district([(0.8,500,100,300),(0.9,700,200,400)])
        ga = self.run_strategy(district,"Genetic")
        self.assertEqual(len(ga.groups),1)
        self.assertTrue(ga.optimal)

    def test_finds_the_group_just_above_the_threshold(self):
        '''Low-ISP districts keep all their value in one group sitting just over
        the floor, where no single-school move helps; only swaps get there.
        Without swaps this falls short of Exact on 6 of these 10 districts.'''
        short = 0
        for trial in range(10):
            rnd = random.Random(trial)
            specs = []
            for lo,hi,count in ((0.45,0.55,4),(0.03,0.17,9)):
                for _ in range(count):
                    enrolled = rnd.randint(300,1500)
                    specs.append((rnd.uniform(lo,hi),enrolled,
                                  round(enrolled*0.2852*rnd.uniform(0.7,1.3)),
                                  round(enrolled*0.5998*rnd.uniform(0.7,1.3))))
            exact = self.run_strategy(self.mk_district(specs),"Exact?max_groups=10")
            ga = self.run_strategy(self.mk_district(specs),"Genetic?max_groups=10")
            short += ga.reimbursement < exact.reimbursement - 0.05
        self.assertLessEqual(short,2)

    def test_fast_value_matches_group_value(self):
        '''_polish scores with an inlined copy of _group_value for speed; the
        two must agree everywhere, including at the threshold and the cap.'''
        rnd = random.Random(99)
        district = self.mk_district(self.random_specs(rnd,12))
        for mode in ("reimbursement","coverage"):
            ga = self.run_strategy(district,"Genetic?evaluate_by=%s&generations=2" % mode)
            fast = ga._value_fn()
            cases = [(0,0,0.0,0.0),(250,1000,10.0,20.0),(2499,10000,5.0,7.0),
                     (24995,100000,5.0,7.0),(625,1000,3.0,9.0),(900,1000,3.0,9.0),(0,500,4.0,4.0)]
            cases += [(rnd.randint(0,2000),rnd.randint(1,3000),rnd.uniform(0,5000),rnd.uniform(0,5000))
                      for _ in range(500)]
            for E,N,A,D in cases:
                self.assertEqual(fast(E,N,A,D),ga._group_value(E,N,A,D),(mode,E,N,A,D))

    def test_no_stop_rule_runs_until_time_limit(self):
        '''patience=0 and generations=0 mean "run for time_limit, however
        stale" -- the extended search relies on this.'''
        rnd = random.Random(4)
        district = self.mk_district(self.random_specs(rnd,25))
        started = time.time()
        ga = self.run_strategy(district,"Genetic?patience=0&generations=0&time_limit=3")
        elapsed = time.time() - started
        self.assertGreaterEqual(elapsed,3)
        self.assertLess(elapsed,10)
        placed = sorted(s.code for g in ga.groups for s in g.schools)
        self.assertEqual(placed,sorted(s.code for s in district.schools))
