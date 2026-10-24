from .linear_solver import GreedyLPStrategy
from .naive import OneToOneCEPStrategy,OneGroupCEPStrategy
from .binning import BinCEPStrategy
from .exhaustive import ExhaustiveCEPStrategy
from .spread import SpreadCEPStrategy
from .pairs import PairsCEPStrategy
from .nyc_moda_simulated_annealing import NYCMODASimulatedAnnealingCEPStrategy
from .exact import ExactCEPStrategy
from .interval_dp import IntervalDPCEPStrategy
from .cp_sat import CPSATCEPStrategy
from .genetic import GeneticCEPStrategy

STRATEGIES = {
    "OneToOne":OneToOneCEPStrategy,
    "OneGroup":OneGroupCEPStrategy,
    "Binning":BinCEPStrategy,
    #"AlgoV2":AlgoV2CEPStrategy,
    "Exhaustive":ExhaustiveCEPStrategy,
    "Exact":ExactCEPStrategy,
    "IntervalDP":IntervalDPCEPStrategy,
    "Spread":SpreadCEPStrategy,
    "Pairs": PairsCEPStrategy,
    "NYCMODA": NYCMODASimulatedAnnealingCEPStrategy,
    "GreedyLP": GreedyLPStrategy,
    "CPSAT": CPSATCEPStrategy,
    "Genetic": GeneticCEPStrategy,
}

