class PolynomialFitter {

  polyFit(x, y, degree) {
    const n = x.length;

    // Build Vandermonde matrix
    const X = [];
    for (let i = 0; i < n; i++) {
      X[i] = [];
      for (let j = 0; j <= degree; j++) {
        X[i][j] = Math.pow(x[i], j);
      }
    }

    // Compute X^T X and X^T y
    const XT = this.transpose(X);
    const XTX = this.multiply(XT, X);
    const XTy = this.multiplyVec(XT, y);

    // Solve (X^T X) c = X^T y
    return this.solveLinearSystem(XTX, XTy);
  }

  transpose(A) {
    return A[0].map((_, i) => A.map(row => row[i]));
  }

  multiply(A, B) {
    const result = Array(A.length).fill(0).map(() => Array(B[0].length).fill(0));
    for (let i = 0; i < A.length; i++) {
      for (let j = 0; j < B[0].length; j++) {
        for (let k = 0; k < B.length; k++) {
          result[i][j] += A[i][k] * B[k][j];
        }
      }
    }
    return result;
  }

  multiplyVec(A, v) {
    return A.map(row => row.reduce((sum, val, i) => sum + val * v[i], 0));
  }

  // Gaussian elimination
  solveLinearSystem(A, b) {
    const n = b.length;

    for (let i = 0; i < n; i++) {
      // Pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
          maxRow = k;
        }
      }
      [A[i], A[maxRow]] = [A[maxRow], A[i]];
      [b[i], b[maxRow]] = [b[maxRow], b[i]];

      // Eliminate
      for (let k = i + 1; k < n; k++) {
        const factor = A[k][i] / A[i][i];
        for (let j = i; j < n; j++) {
          A[k][j] -= factor * A[i][j];
        }
        b[k] -= factor * b[i];
      }
    }

    // Back substitution
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = b[i];
      for (let j = i + 1; j < n; j++) {
        sum -= A[i][j] * x[j];
      }
      x[i] = sum / A[i][i];
    }

    return x;
  }
}

export const PolyFit = new PolynomialFitter();
