package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAPI(t *testing.T) {
	// Initialisation du serveur de test virtuel (évite d'ouvrir un vrai port réseau)
	server := httptest.NewServer(http.HandlerFunc(requestHandler))
	defer server.Close()

	// --- 1. CAS NOMINAUX ---
	t.Run("Cas nominaux", func(t *testing.T) {
		cases := []struct {
			op       string
			a, b     string
			expected float64
		}{
			{"add", "2", "3", 5},
			{"subtract", "10", "4", 6},
			{"multiply", "6", "7", 42},
			{"divide", "20", "5", 4},
		}

		for _, tc := range cases {
			req, _ := http.NewRequest("GET", server.URL+"/calculate?operation="+tc.op+"&a="+tc.a+"&b="+tc.b, nil)
			resp, _ := http.DefaultClient.Do(req)

			if resp.StatusCode != http.StatusOK {
				t.Errorf("Attendu 200, reçu %d pour %s", resp.StatusCode, tc.op)
			}

			var data CalcResponse
			json.NewDecoder(resp.Body).Decode(&data)
			resp.Body.Close()

			if data.Result != tc.expected {
				t.Errorf("Attendu %f, reçu %f pour %s", tc.expected, data.Result, tc.op)
			}
		}
	})

	// --- 2. ERREURS 400 ---
	t.Run("Erreur 400 - Division par zero", func(t *testing.T) {
		req, _ := http.NewRequest("GET", server.URL+"/calculate?operation=divide&a=10&b=0", nil)
		resp, _ := http.DefaultClient.Do(req)
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Attendu 400, reçu %d", resp.StatusCode)
		}
	})

	t.Run("Erreur 400 - Non numerique", func(t *testing.T) {
		req, _ := http.NewRequest("GET", server.URL+"/calculate?operation=add&a=abc&b=3", nil)
		resp, _ := http.DefaultClient.Do(req)
		defer resp.Body.Close()

		var data ErrorResponse
		json.NewDecoder(resp.Body).Decode(&data)

		if !strings.Contains(data.Error, "doivent être des nombres") {
			t.Errorf("Message d'erreur incorrect : %s", data.Error)
		}
	})

	// --- 3. ERREUR 405 (METHOD NOT ALLOWED) ---
	t.Run("Erreur 405 - POST non autorise", func(t *testing.T) {
		req, _ := http.NewRequest("POST", server.URL+"/calculate", nil)
		resp, _ := http.DefaultClient.Do(req)
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusMethodNotAllowed {
			t.Errorf("Attendu 405, reçu %d", resp.StatusCode)
		}
	})

	// --- 4. ACCÈS RACINE FRONT-END ---
	t.Run("Racine retourne le HTML", func(t *testing.T) {
		req, _ := http.NewRequest("GET", server.URL+"/", nil)
		resp, _ := http.DefaultClient.Do(req)
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Attendu 200 pour la racine, reçu %d", resp.StatusCode)
		}
		
		contentType := resp.Header.Get("Content-Type")
		if !strings.Contains(contentType, "text/html") {
			t.Errorf("Attendu text/html, reçu %s", contentType)
		}
	})
}