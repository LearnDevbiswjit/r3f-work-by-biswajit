// vite.config.ts
import { defineConfig } from "file:///D:/2025/r3f-biswajit/node_modules/vite/dist/node/index.js";
import react from "file:///D:/2025/r3f-biswajit/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { fileURLToPath, URL } from "node:url";
var __vite_injected_original_import_meta_url = "file:///D:/2025/r3f-biswajit/vite.config.ts";
var vite_config_default = defineConfig({
  plugins: [react()],
  base: "/",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url))
    }
  },
  assetsInclude: ["**/*.mp4"],
  build: {
    rollupOptions: { output: { manualChunks: {} } },
    chunkSizeWarningLimit: 5e3
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFwyMDI1XFxcXHIzZi1iaXN3YWppdFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxcMjAyNVxcXFxyM2YtYmlzd2FqaXRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6LzIwMjUvcjNmLWJpc3dhaml0L3ZpdGUuY29uZmlnLnRzXCI7Ly8gdml0ZS5jb25maWcuanNcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBVUkwgfSBmcm9tICdub2RlOnVybCdcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCldLFxuICAgYmFzZTogJy8nLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogZmlsZVVSTFRvUGF0aChuZXcgVVJMKCcuL3NyYycsIGltcG9ydC5tZXRhLnVybCkpLFxuICAgIH0sXG4gIH0sXG4gIGFzc2V0c0luY2x1ZGU6IFsnKiovKi5tcDQnXSxcbiAgYnVpbGQ6IHtcbiAgICByb2xsdXBPcHRpb25zOiB7IG91dHB1dDogeyBtYW51YWxDaHVua3M6IHt9IH0gfSxcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDUwMDAsXG4gIH0sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUNBLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sV0FBVztBQUNsQixTQUFTLGVBQWUsV0FBVztBQUhrSCxJQUFNLDJDQUEyQztBQUt0TSxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDaEIsTUFBTTtBQUFBLEVBQ1AsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxjQUFjLElBQUksSUFBSSxTQUFTLHdDQUFlLENBQUM7QUFBQSxJQUN0RDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLGVBQWUsQ0FBQyxVQUFVO0FBQUEsRUFDMUIsT0FBTztBQUFBLElBQ0wsZUFBZSxFQUFFLFFBQVEsRUFBRSxjQUFjLENBQUMsRUFBRSxFQUFFO0FBQUEsSUFDOUMsdUJBQXVCO0FBQUEsRUFDekI7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
