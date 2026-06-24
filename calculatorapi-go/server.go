package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
)

const PORT = ":3000"
var calc = &Calculator{}

type ErrorResponse struct {
	Error string `json:"error"`
}

type CalcResponse struct {
	Operation string  `json:"operation"`
	A         float64 `json:"a"`
	B         float64 `json:"b"`
	Result    float64 `json:"result"`
}

func setCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

func requestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		setCORS(w)
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// 1. ROUTE : Racine "/" ou "/index.html" -> Servir le Front-end
	if r.URL.Path == "/" || r.URL.Path == "/index.html" {
		if r.Method != "GET" {
			w.Header().Set("Allow", "GET, OPTIONS")
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			setCORS(w)
			w.WriteHeader(http.StatusMethodNotAllowed)
			json.NewEncoder(w).Encode(ErrorResponse{Error: "Méthode non autorisée. Utiliser GET."})
			return
		}

		filePath := filepath.Join(".", "public", "index.html")
		setCORS(w)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		http.ServeFile(w, r, filePath)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	if r.Method != "GET" {
		w.Header().Set("Allow", "GET, OPTIONS")
		setCORS(w)
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Méthode non autorisée. Utiliser GET."})
		return
	}

	// 2. ROUTE : Route inconnue (404)
	if r.URL.Path != "/calculate" {
		setCORS(w)
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Route introuvable."})
		return
	}

	// 3. ROUTE : "/calculate"
	query := r.URL.Query()
	operation := query.Get("operation")
	aRaw := query.Get("a")
	bRaw := query.Get("b")

	if operation == "" || query.Get("a") == "" || query.Get("b") == "" {
		setCORS(w)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Paramètres attendus : operation, a, b"})
		return
	}

	numA, errA := strconv.ParseFloat(aRaw, 64)
	numB, errB := strconv.ParseFloat(bRaw, 64)
	if errA != nil || errB != nil {
		setCORS(w)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Les paramètres a et b doivent être des nombres."})
		return
	}

	if operation != "add" && operation != "subtract" && operation != "multiply" && operation != "divide" {
		setCORS(w)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Opération inconnue. Utiliser : add, subtract, multiply, divide"})
		return
	}

	var result float64
	var calcErr error

	switch operation {
	case "add":
		result = calc.Add(numA, numB)
	case "subtract":
		result = calc.Subtract(numA, numB)
	case "multiply":
		result = calc.Multiply(numA, numB)
	case "divide":
		result, calcErr = calc.Divide(numA, numB)
	}

	if calcErr != nil {
		setCORS(w)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: calcErr.Error()})
		return
	}

	setCORS(w)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(CalcResponse{
		Operation: operation,
		A:         numA,
		B:         numB,
		Result:    result,
	})
}

func main() {
	http.HandleFunc("/", requestHandler)
	// Ne pas bloquer si lancé via les tests
	if os.Getenv("GO_ENV") != "test" {
		fmt.Printf("Serveur démarré sur http://localhost%s\n", PORT)
		if err := http.ListenAndServe(PORT, nil); err != nil {
			panic(err)
		}
	}
}