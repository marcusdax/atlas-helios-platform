"""
Nexus Mind Performance Benchmarks

Performance benchmarks for NADE, GIE, BNE engines with GPU acceleration.
"""

import time
import json
import statistics
import torch
import numpy as np
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
from datetime import datetime


@dataclass
class BenchmarkResult:
    """Result of a benchmark run."""

    name: str
    iterations: int
    avg_time_ms: float
    p50_ms: float
    p95_ms: float
    p99_ms: float
    min_ms: float
    max_ms: float
    std_dev_ms: float
    throughput_rps: float


class PerformanceBenchmark:
    """Performance benchmarking suite for Nexus Mind engines."""

    def __init__(self, device: str = "cuda" if torch.cuda.is_available() else "cpu"):
        self.device = device
        self.results: List[BenchmarkResult] = []

    def run_benchmark(
        self,
        name: str,
        func,
        iterations: int = 100,
        warmup: int = 10,
    ) -> BenchmarkResult:
        """Run a benchmark."""
        times = []

        for _ in range(warmup):
            func()

        for _ in range(iterations):
            start = time.perf_counter()
            func()
            elapsed = (time.perf_counter() - start) * 1000
            times.append(elapsed)

        times.sort()
        avg_time = statistics.mean(times)
        throughput = 1000 / avg_time if avg_time > 0 else 0

        result = BenchmarkResult(
            name=name,
            iterations=iterations,
            avg_time_ms=avg_time,
            p50_ms=statistics.median(times),
            p95_ms=times[int(len(times) * 0.95)],
            p99_ms=times[int(len(times) * 0.99)],
            min_ms=min(times),
            max_ms=max(times),
            std_dev_ms=statistics.stdev(times) if len(times) > 1 else 0,
            throughput_rps=throughput,
        )

        self.results.append(result)
        return result

    def print_results(self):
        """Print benchmark results."""
        print("\n" + "=" * 80)
        print("NEXUS MIND PERFORMANCE BENCHMARKS")
        print("=" * 80)
        print(f"Device: {self.device}")
        print(f"Date: {datetime.now().isoformat()}")
        print("=" * 80)

        for result in self.results:
            print(f"\n{result.name}")
            print(f"  Iterations:    {result.iterations}")
            print(f"  Average:       {result.avg_time_ms:.2f} ms")
            print(f"  P50 (Median): {result.p50_ms:.2f} ms")
            print(f"  P95:          {result.p95_ms:.2f} ms")
            print(f"  P99:          {result.p99_ms:.2f} ms")
            print(f"  Min:          {result.min_ms:.2f} ms")
            print(f"  Max:          {result.max_ms:.2f} ms")
            print(f"  Std Dev:      {result.std_dev_ms:.2f} ms")
            print(f"  Throughput:   {result.throughput_rps:.1f} req/s")

    def save_results(self, filepath: str):
        """Save results to JSON file."""
        data = [
            {
                "name": r.name,
                "iterations": r.iterations,
                "avg_time_ms": r.avg_time_ms,
                "p50_ms": r.p50_ms,
                "p95_ms": r.p95_ms,
                "p99_ms": r.p99_ms,
                "min_ms": r.min_ms,
                "max_ms": r.max_ms,
                "std_dev_ms": r.std_dev_ms,
                "throughput_rps": r.throughput_rps,
            }
            for r in self.results
        ]

        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)


class NadeBenchmark:
    """Benchmarks for NADE engine."""

    @staticmethod
    def benchmark_inference(
        input_dim: int = 64,
        hidden_dim: int = 128,
        batch_sizes: List[int] = [1, 4, 16, 64],
        iterations: int = 100,
    ) -> Dict[str, Any]:
        """Benchmark NADE inference."""
        from nexus_mind.core.nade import NADEEngine

        device = "cuda" if torch.cuda.is_available() else "cpu"
        results = {}

        for batch_size in batch_sizes:
            engine = NADEEngine(
                input_dim=input_dim,
                hidden_dim=hidden_dim,
            ).to(device)

            x = torch.randn(batch_size, 10, input_dim).to(device)

            benchmark = PerformanceBenchmark(device)

            def run_inference():
                with torch.no_grad():
                    engine(x)

            result = benchmark.run_benchmark(
                name=f"NADE Inference (batch={batch_size})",
                func=run_inference,
                iterations=iterations,
            )

            results[batch_size] = {
                "avg_ms": result.avg_time_ms,
                "p95_ms": result.p95_ms,
                "throughput": result.throughput_rps,
            }

        return results


class GieBenchmark:
    """Benchmarks for GIE engine."""

    @staticmethod
    def benchmark_inference(
        img_size: int = 224,
        embed_dim: int = 256,
        batch_sizes: List[int] = [1, 4, 16],
        iterations: int = 100,
    ) -> Dict[str, Any]:
        """Benchmark GIE inference."""
        from nexus_mind.core.gie import GIEEngine

        device = "cuda" if torch.cuda.is_available() else "cpu"
        results = {}

        for batch_size in batch_sizes:
            engine = GIEEngine(
                img_size=img_size,
                embed_dim=embed_dim,
            ).to(device)

            x = torch.randn(batch_size, 3, img_size, img_size).to(device)

            benchmark = PerformanceBenchmark(device)

            def run_inference():
                with torch.no_grad():
                    engine(x)

            result = benchmark.run_benchmark(
                name=f"GIE Inference (batch={batch_size})",
                func=run_inference,
                iterations=iterations,
            )

            results[batch_size] = {
                "avg_ms": result.avg_time_ms,
                "p95_ms": result.p95_ms,
                "throughput": result.throughput_rps,
            }

        return results


class BneBenchmark:
    """Benchmarks for BNE engine."""

    @staticmethod
    def benchmark_inference(
        input_dim: int = 64,
        hidden_dim: int = 256,
        seq_lengths: List[int] = [10, 50, 100],
        iterations: int = 100,
    ) -> Dict[str, Any]:
        """Benchmark BNE inference."""
        from nexus_mind.core.bne import BNEEngine

        device = "cuda" if torch.cuda.is_available() else "cpu"
        results = {}

        for seq_len in seq_lengths:
            engine = BNEEngine(
                input_dim=input_dim,
                hidden_dim=hidden_dim,
            ).to(device)

            x = torch.randn(1, seq_len, input_dim).to(device)

            benchmark = PerformanceBenchmark(device)

            def run_inference():
                with torch.no_grad():
                    engine(x)

            result = benchmark.run_benchmark(
                name=f"BNE Inference (seq_len={seq_len})",
                func=run_inference,
                iterations=iterations,
            )

            results[seq_len] = {
                "avg_ms": result.avg_time_ms,
                "p95_ms": result.p95_ms,
                "throughput": result.throughput_rps,
            }

        return results


class FusionBenchmark:
    """Benchmarks for fusion engine."""

    @staticmethod
    def benchmark_fusion(
        feature_dims: List[int] = [128, 256, 256],
        iterations: int = 100,
    ) -> Dict[str, Any]:
        """Benchmark fusion."""
        from nexus_mind.core.fusion import FusionEngine

        device = "cuda" if torch.cuda.is_available() else "cpu"
        engine = FusionEngine(feature_dims=feature_dims).to(device)

        features = [torch.randn(1, dim).to(device) for dim in feature_dims]

        benchmark = PerformanceBenchmark(device)

        def run_fusion():
            with torch.no_grad():
                engine(features)

        result = benchmark.run_benchmark(
            name="Fusion Engine",
            func=run_fusion,
            iterations=iterations,
        )

        return {
            "avg_ms": result.avg_time_ms,
            "p95_ms": result.p95_ms,
            "throughput": result.throughput_rps,
        }


class LoadTest:
    """Load testing for concurrent requests."""

    @staticmethod
    def run_load_test(
        engine,
        input_fn,
        concurrent_requests: List[int] = [1, 10, 50, 100],
        duration_seconds: int = 10,
    ) -> Dict[str, Any]:
        """Run load test with concurrent requests."""
        import threading

        results = {}
        device = "cuda" if torch.cuda.is_available() else "cpu"

        for num_requests in concurrent_requests:
            latencies = []
            errors = 0
            lock = threading.Lock()

            def make_request():
                nonlocal errors
                try:
                    x = input_fn()
                    if hasattr(engine, "to"):
                        x = x.to(device)

                    start = time.perf_counter()
                    with torch.no_grad():
                        engine(x)
                    latency = (time.perf_counter() - start) * 1000

                    with lock:
                        latencies.append(latency)
                except Exception as e:
                    with lock:
                        errors += 1

            threads = []
            start_time = time.time()

            while time.time() - start_time < duration_seconds:
                for _ in range(num_requests):
                    t = threading.Thread(target=make_request)
                    t.start()
                    threads.append(t)

                time.sleep(0.01)

            for t in threads:
                t.join()

            latencies.sort()
            total_requests = len(latencies) + errors

            results[num_requests] = {
                "total_requests": total_requests,
                "successful": len(latencies),
                "errors": errors,
                "avg_latency_ms": statistics.mean(latencies) if latencies else 0,
                "p95_latency_ms": latencies[int(len(latencies) * 0.95)]
                if latencies
                else 0,
                "p99_latency_ms": latencies[int(len(latencies) * 0.99)]
                if latencies
                else 0,
                "throughput_rps": total_requests / duration_seconds,
            }

        return results


def run_all_benchmarks():
    """Run all benchmarks."""
    print("\nRunning Nexus Mind Benchmarks...\n")

    benchmark = PerformanceBenchmark()

    print("Running NADE benchmarks...")
    nade_results = NadeBenchmark.benchmark_inference()
    print(f"  NADE results: {json.dumps(nade_results, indent=2)}")

    print("\nRunning GIE benchmarks...")
    gie_results = GieBenchmark.benchmark_inference()
    print(f"  GIE results: {json.dumps(gie_results, indent=2)}")

    print("\nRunning BNE benchmarks...")
    bne_results = BneBenchmark.benchmark_inference()
    print(f"  BNE results: {json.dumps(bne_results, indent=2)}")

    print("\nRunning Fusion benchmarks...")
    fusion_results = FusionBenchmark.benchmark_fusion()
    print(f"  Fusion results: {json.dumps(fusion_results, indent=2)}")

    print("\n" + "=" * 80)
    print("Benchmark complete!")
    print("=" * 80)


if __name__ == "__main__":
    run_all_benchmarks()


__all__ = [
    "PerformanceBenchmark",
    "BenchmarkResult",
    "NadeBenchmark",
    "GieBenchmark",
    "BneBenchmark",
    "FusionBenchmark",
    "LoadTest",
    "run_all_benchmarks",
]
