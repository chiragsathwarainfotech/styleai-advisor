import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ScanHistoryItem {
  id: string;
  user_id: string;
  image_url: string;
  thumbnail_url: string | null;
  analysis_text: string;
  style_score: number | null;
  outfit_category: string | null;
  created_at: string;
  signed_image_url?: string;
}

const FREE_HISTORY_LIMIT = 5;
const BATCH_SIZE = 10;
const SIGNED_URL_EXPIRY = 3600; // 1 hour

// Extract storage path from full URL or stored path
const getStoragePath = (imageUrl: string): string | null => {
  if (!imageUrl) return null;
  
  // If it's already just a path (userId/timestamp.jpg format)
  if (!imageUrl.startsWith('http')) {
    return imageUrl;
  }
  
  // Extract path from full Supabase storage URL
  const match = imageUrl.match(/scan-images\/(.+)$/);
  return match ? match[1] : null;
};

export function useScanHistory(userId: string | null, isPremium: boolean) {
  const [scans, setScans] = useState<ScanHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  // Generate signed URLs for private images
  const generateSignedUrls = useCallback(async (items: ScanHistoryItem[]): Promise<ScanHistoryItem[]> => {
    const itemsWithSignedUrls = await Promise.all(
      items.map(async (item) => {
        const storagePath = getStoragePath(item.image_url);
        if (!storagePath) {
          return { ...item, signed_image_url: undefined };
        }

        const { data, error } = await supabase.storage
          .from("scan-images")
          .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

        if (error) {
          console.error("Error generating signed URL:", error);
          return { ...item, signed_image_url: undefined };
        }

        return { ...item, signed_image_url: data.signedUrl };
      })
    );

    return itemsWithSignedUrls;
  }, []);

  const fetchScans = useCallback(async (pageNum: number = 0, reset: boolean = false) => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const from = pageNum * BATCH_SIZE;
      const to = from + BATCH_SIZE - 1;

      const { data, error } = await supabase
        .from("scan_history")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (data) {
        // Generate signed URLs for the fetched items
        const itemsWithSignedUrls = await generateSignedUrls(data);

        if (reset) {
          setScans(itemsWithSignedUrls);
        } else {
          setScans(prev => [...prev, ...itemsWithSignedUrls]);
        }
        setHasMore(data.length === BATCH_SIZE);
      }
    } catch (error) {
      console.error("Error fetching scan history:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, generateSignedUrls]);

  useEffect(() => {
    if (userId) {
      fetchScans(0, true);
      setPage(0);
    }
  }, [userId, fetchScans]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchScans(nextPage);
    }
  }, [isLoading, hasMore, page, fetchScans]);

  const deleteScan = useCallback(async (scanId: string) => {
    if (!userId || !isPremium) return false;

    try {
      // First, get the scan to find the image path
      const scanToDelete = scans.find(s => s.id === scanId);
      if (!scanToDelete) return false;

      const storagePath = getStoragePath(scanToDelete.image_url);

      // Delete from database first
      const { error: dbError } = await supabase
        .from("scan_history")
        .delete()
        .eq("id", scanId)
        .eq("user_id", userId);

      if (dbError) throw dbError;

      // Then delete from storage if path exists
      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from("scan-images")
          .remove([storagePath]);

        if (storageError) {
          console.error("Error deleting image from storage:", storageError);
          // Don't fail the operation if storage delete fails - the DB record is already gone
        }
      }

      setScans(prev => prev.filter(s => s.id !== scanId));
      return true;
    } catch (error) {
      console.error("Error deleting scan:", error);
      return false;
    }
  }, [userId, isPremium, scans]);

  const saveScan = useCallback(async (
    imageBase64: string,
    analysisText: string,
    styleScore?: number,
    outfitCategory?: string
  ): Promise<boolean> => {
    if (!userId) return false;

    try {
      // Upload image to private storage
      const fileName = `${userId}/${Date.now()}.jpg`;
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      const { error: uploadError } = await supabase.storage
        .from("scan-images")
        .upload(fileName, binaryData, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Store only the path in the database (not the full URL)
      // This ensures we always use signed URLs for access
      const { error: insertError } = await supabase
        .from("scan_history")
        .insert({
          user_id: userId,
          image_url: fileName, // Store path only, not public URL
          thumbnail_url: fileName,
          analysis_text: analysisText,
          style_score: styleScore ?? null,
          outfit_category: outfitCategory ?? null,
        });

      if (insertError) throw insertError;

      // Refresh the list
      fetchScans(0, true);
      setPage(0);
      return true;
    } catch (error) {
      console.error("Error saving scan:", error);
      return false;
    }
  }, [userId, fetchScans]);

  // Delete all scans for the user
  const deleteAllScans = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;

    try {
      // Get all scans to find storage paths
      const { data: allScans, error: fetchError } = await supabase
        .from("scan_history")
        .select("image_url")
        .eq("user_id", userId);

      if (fetchError) throw fetchError;

      // Delete all from database first
      const { error: dbError } = await supabase
        .from("scan_history")
        .delete()
        .eq("user_id", userId);

      if (dbError) throw dbError;

      // Then delete all images from storage
      if (allScans && allScans.length > 0) {
        const storagePaths = allScans
          .map(s => getStoragePath(s.image_url))
          .filter((p): p is string => p !== null);

        if (storagePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from("scan-images")
            .remove(storagePaths);

          if (storageError) {
            console.error("Error deleting images from storage:", storageError);
          }
        }
      }

      setScans([]);
      setPage(0);
      setHasMore(false);
      return true;
    } catch (error) {
      console.error("Error deleting all scans:", error);
      return false;
    }
  }, [userId]);

  // Get visible scans based on premium status
  const visibleScans = isPremium ? scans : scans.slice(0, FREE_HISTORY_LIMIT);
  const lockedScans = isPremium ? [] : scans.slice(FREE_HISTORY_LIMIT);
  const totalCount = scans.length;

  return {
    scans: visibleScans,
    lockedScans,
    totalCount,
    isLoading,
    hasMore,
    loadMore,
    deleteScan,
    deleteAllScans,
    saveScan,
    refetch: () => { fetchScans(0, true); setPage(0); },
    FREE_HISTORY_LIMIT,
  };
}
